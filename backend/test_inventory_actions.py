import asyncio
from services.voice_service import fallback_regex_parse

def test_nlu_intent_parsing():
    print("==================================================")
    print("Testing Kirana Vernacular NLU Intent Parsing")
    print("==================================================")

    test_cases = [
        ("3 Maggi becha ₹42 me", "SALE", 3.0, "packet"),
        ("10 Maggi aaya stock me", "RESTOCK", 10.0, "packet"),
        ("750 gram chawal becha", "SALE", 0.75, "kg"),
        ("2 packet kharab ho gaya", "DAMAGE", 2.0, "packet"),
        ("Maggi dukaan me 18 bacha hai", "CORRECTION", 18.0, "packet")
    ]

    for transcript, expected_action, expected_qty, expected_unit in test_cases:
        res = fallback_regex_parse(transcript)
        print(f"\nTranscript: '{transcript}'")
        print(f"  Detected Action: {res.get('action_type')} (Expected: {expected_action})")
        print(f"  Detected Qty: {res.get('quantity')} {res.get('unit')} (Expected: {expected_qty} {expected_unit})")
        
        assert res.get('action_type') == expected_action, f"Action mismatch for {transcript}"
        assert abs(res.get('quantity') - expected_qty) < 0.01, f"Qty mismatch for {transcript}"
        assert res.get('unit') == expected_unit, f"Unit mismatch for {transcript}"

    print("\n✅ All Vernacular Intent NLU test cases passed successfully!")

if __name__ == "__main__":
    test_nlu_intent_parsing()
