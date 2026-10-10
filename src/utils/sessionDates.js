export default function getSessionDates() {
  const start = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      weekday: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
      day: new Intl.DateTimeFormat('en', { day: 'numeric' }).format(date),
    };
  });
}
