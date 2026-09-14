export const tools = [
  {
    type: "function",
    function: {
      name: "list_services",
      description: "List all bookable services, their providers, durations, and prices.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_available_slots",
      description:
        "Get open appointment slots for a service on a date. Returns each slot with an index and a human-readable time — use the index (never a raw time) when calling book_appointment.",
      parameters: {
        type: "object",
        properties: {
          serviceId: { type: "string" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
        },
        required: ["serviceId", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description:
        "Book a slot by its index, from the most recent get_available_slots call for that exact service and date. Only call this after the user has clearly agreed to one specific slot.",
      parameters: {
        type: "object",
        properties: {
          serviceId: { type: "string" },
          providerId: { type: "string" },
          date: { type: "string", description: "The same YYYY-MM-DD date used in the get_available_slots call this slot's index came from" },
          slotIndex: { type: "integer", description: "The index of the chosen slot, exactly as returned by get_available_slots for that date" },
        },
        required: ["serviceId", "providerId", "date", "slotIndex"],
      },
    },
  },
];
