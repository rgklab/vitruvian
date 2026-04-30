def get_color_for_health_score(health_score):
    """Get color based on health score (0=red, 0.5=yellow, <1.0=green shades). Fully healthy (1.0) returns None."""
    if health_score is None or health_score >= 1.0:
        return None
    # Clamp score
    health_score = max(0.0, min(1.0, health_score))
    if health_score <= 0.5:
        # Red to Yellow
        # 0.0 -> Red (1,0,0), 0.5 -> Yellow (1,1,0)
        r = 1.0
        g = 2 * health_score
        b = 0.0
    else:
        # Yellow to Green
        # 0.5 -> Yellow (1,1,0), 1.0 -> Green (0,1,0)
        r = 2 * (1.0 - health_score)
        g = 1.0
        b = 0.0
    return [r, g, b]

def get_no_data_color():
    """Get color for no data state."""
    return [42/255, 42/255, 42/255]  # Dark Gray