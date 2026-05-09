let _isAndroid: boolean | null = null;

export function isAndroid(): boolean {
  if (_isAndroid !== null) return _isAndroid;
  _isAndroid =
    typeof navigator !== 'undefined' &&
    /Android/i.test(navigator.userAgent);
  return _isAndroid;
}

export function isDesktop(): boolean {
  return !isAndroid();
}
