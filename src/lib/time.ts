export function getTimeOfDay(hour: number): string {
  if (hour >= 7 && hour < 9) return '早晨';
  if (hour >= 9 && hour < 12) return '上午工作时段';
  if (hour >= 12 && hour < 14) return '午餐时间';
  if (hour >= 14 && hour < 17) return '下午工作时段';
  if (hour >= 17 && hour < 20) return '傍晚放松时段';
  if (hour >= 20 && hour < 23) return '晚间休息时段';
  return '深夜';
}
