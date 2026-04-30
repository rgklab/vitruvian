from flask import request, jsonify
from google.genai import Client
from utils.fhir_outputs import (
    build_fhir_communication,
    wrap_in_fhir_bundle,
    add_resource_to_bundle,
)
import globals
import os
import re

# Initialize client safely to prevent startup crash when API key is missing
client = None
try:
    # If the environment variables are set, initialize the client
    client = Client()
except Exception as e:
    print(f"Gemini Client initialization delayed (API key may be missing): {e}")

def clean_genai_response(text):
    """
    Strip Markdown, HTML tags, extra whitespace from GenAI response.
    """
    if not text:
        return ""

    # Remove HTML tags
    text = re.sub(r"<[^>]*>", "", text)

    # Remove Markdown links/images
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)  # images
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)  # links

    # Optional: remove other Markdown formatting (*, **, `, #)
    text = re.sub(r"[*_`#>]", "", text)

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()

    return text

def handle_chat():
    global client
    print("handle_chat() called")
    data = request.get_json()
    user_message = data.get('message', '')
    if not user_message:
        return jsonify({'error': 'Empty message'}), 400

    if client is None:
        try:
            client = Client()
        except Exception as e:
            reply = "Gemini API key is not set. Please set the GEMINI_API_KEY or GOOGLE_API_KEY environment variable to use the Clinical Chat."
            return jsonify({"reply": reply})

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_message,
            # optional: config=types.GenerateContentConfig(...)
        )
        raw_text = response.text
        reply = clean_genai_response(raw_text)
        comm_resource = build_fhir_communication(user_message, reply)
        if globals.latest_fhir_bundle is None:
            print("none bundle in chat")
            globals.latest_fhir_bundle = wrap_in_fhir_bundle([comm_resource])
            print(globals.latest_fhir_bundle)
        else:
            add_resource_to_bundle(globals.latest_fhir_bundle, comm_resource)
    except Exception as e:
        reply = f"Error from Gemini: {str(e)}"
    return jsonify({"reply": reply})