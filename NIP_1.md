# NIP-50: 50/50 Fundraiser Events

This NIP defines event kinds for creating and managing 50/50 fundraisers on Nostr.

## Event Kinds

### 30050: Fundraiser Creation

A replaceable event that creates a new fundraiser. The event's `d` tag should be a unique identifier for the fundraiser.

```json
{
  "kind": 30050,
  "content": {
    "id": "string",
    "title": "string",
    "description": "string",
    "goal": "number",
    "raised": "number",
    "organizer": "string",
    "cause": "string",
    "createdAt": "number"
  },
  "tags": [
    ["d", "fundraiser-id"]
  ]
}
```

### 30051: Donation

A regular event that represents a donation to a fundraiser. The event should reference the fundraiser event and the organizer.

```json
{
  "kind": 30051,
  "content": {
    "fundraiserId": "string",
    "amount": "number",
    "paymentRequest": "string"
  },
  "tags": [
    ["e", "fundraiser-id"],
    ["p", "organizer-pubkey"]
  ]
}
```

## Event Behavior

- Kind 30050 events are replaceable, meaning only the latest event per pubkey+kind+d-tag combination is stored
- Kind 30051 events are regular events that are stored permanently
- The `raised` field in kind 30050 events should be updated by the organizer to reflect the total amount raised
- The `paymentRequest` field in kind 30051 events should be a valid Lightning payment request
- The `amount` field in kind 30051 events represents the donation amount in satoshis

## Security Considerations

- Organizers should verify that the payment request has been paid before updating the `raised` amount
- Donors should verify that the payment request is valid and from the correct organizer
- The 50/50 split should be handled by the organizer's Lightning node configuration