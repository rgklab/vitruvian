# Vitruvian Backend
This is the backend of the Vitruvian web application based on `Python` and `Flask`.

## Install the backend
1. Create and activate a virtual environment (recommended):
   ```bash
   cd backend
   python -m venv venv
   # macOS: source venv/bin/activate
   # Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set API key for the chatbot:
   * Follow [Google's instructions](https://ai.google.dev/gemini-api/docs/quickstart)
   * Set up your key in the environment
   * Keep your API key private and secure!

## To run the backend
```bash
cd backend
python app.py
python server.py
```

## `app.py`
This is the main backend application for Vitruvian.

## `server.py`
This is an application that simulates a third-party ML model that is hosted either locally or on cloud. Vitruvian communicates with the model via `API`.