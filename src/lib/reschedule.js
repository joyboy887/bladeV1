// Remove the booking currently being moved so it doesn't block its own slot.
export function otherBookings(bookings, excludeId) {
  if (!excludeId) return bookings;
  return bookings.filter((b) => b.id !== excludeId);
}
