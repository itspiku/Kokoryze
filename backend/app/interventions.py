"""Library of supportive activities. These are wellbeing suggestions, not treatments."""

INTERVENTIONS: list[dict] = [
    {
        "id": "box_breathing", "title": "Box breathing", "category": "relaxation",
        "duration_min": 3, "screen": "breathing",
        "instructions": "Breathe in for 4, hold for 4, out for 4, hold for 4. Follow the circle.",
        "good_for": ["anxious", "poor_sleep", "low_mood", "steady"],
        "times": ["morning", "afternoon", "evening"],
    },
    {
        "id": "body_scan", "title": "Body-scan audio", "category": "relaxation",
        "duration_min": 5, "screen": "timer",
        "instructions": "Lie or sit comfortably. Slowly move your attention from your toes to the top of your head.",
        "good_for": ["anxious", "poor_sleep"],
        "times": ["afternoon", "evening"],
    },
    {
        "id": "walk_outside", "title": "10-minute walk outside", "category": "activation",
        "duration_min": 10, "screen": "timer",
        "instructions": "Step outside and walk at an easy pace. Notice three things you can see or hear.",
        "good_for": ["low_energy", "low_mood", "steady"],
        "times": ["morning", "afternoon"],
    },
    {
        "id": "small_task", "title": "One small task", "category": "activation",
        "duration_min": 5, "screen": "timer",
        "instructions": "Pick one tiny thing: make tea, open a window, tidy one surface. Just one.",
        "good_for": ["low_energy", "low_mood"],
        "times": ["morning", "afternoon", "evening"],
    },
    {
        "id": "stretch", "title": "Gentle stretching", "category": "activation",
        "duration_min": 5, "screen": "timer",
        "instructions": "Slow neck rolls, shoulder circles and a forward fold. Move gently, never into pain.",
        "good_for": ["low_energy", "anxious", "steady"],
        "times": ["morning", "afternoon", "evening"],
    },
    {
        "id": "message_friend", "title": "Message someone you trust", "category": "social",
        "duration_min": 2, "screen": "message",
        "instructions": "Send a short message to someone you like. It doesn't need to be about how you feel.",
        "good_for": ["low_mood", "anxious", "steady"],
        "times": ["morning", "afternoon", "evening"],
    },
    {
        "id": "call_friend", "title": "Call a friend", "category": "social",
        "duration_min": 10, "screen": "timer",
        "instructions": "A short call is enough. Ask how their day was.",
        "good_for": ["low_mood", "low_energy"],
        "times": ["afternoon", "evening"],
    },
    {
        "id": "forest_sounds", "title": "Forest soundscape", "category": "sensory",
        "duration_min": 5, "screen": "nature",
        "instructions": "Close your eyes and listen. Let the colours on screen slow your breathing.",
        "good_for": ["anxious", "poor_sleep", "low_mood"],
        "times": ["afternoon", "evening"],
    },
    {
        "id": "morning_light", "title": "Morning daylight", "category": "sensory",
        "duration_min": 10, "screen": "timer",
        "instructions": "Spend 10 minutes near a window or outside soon after waking.",
        "good_for": ["poor_sleep", "low_energy", "low_mood"],
        "times": ["morning"],
    },
]

BY_ID = {i["id"]: i for i in INTERVENTIONS}

# Calm, seated activities that can be paired with an EEG brain session.
BRAIN_ACTIVITIES = ["box_breathing", "body_scan", "forest_sounds"]

STATE_LABELS = {
    "low_energy": "low on energy",
    "anxious": "anxious",
    "poor_sleep": "short on sleep",
    "low_mood": "low",
    "steady": "steady",
}
