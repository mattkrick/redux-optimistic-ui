export function findIndex(arr, predicate) {
  const l = arr.length;
  for (let i = 0; i < l; i++) {
    if (predicate(arr[i])) {
      return i;
    }
  }
  return -1;
}
