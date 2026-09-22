function getWorkingDays(year, month) {
  const days = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const totalDays = new Date(year, month, 0).getDate();
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(year, month - 1, d);
    const dayOfWeek = dt.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const yyyy = year;
      const mm = String(month).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      days.push({ date: `${yyyy}-${mm}-${dd}`, day: dayNames[dayOfWeek] });
    }
  }
  return days;
}

const sep = getWorkingDays(2026, 9);
const oct = getWorkingDays(2026, 10);
console.log('Sep 2026 Working Days:', sep.length);
console.log('Oct 2026 Working Days:', oct.length);
console.log('Oct first 3:', oct.slice(0, 3));
console.log('Oct last 3:', oct.slice(-3));
