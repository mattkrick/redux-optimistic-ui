export function findIndex(arr, predicate) {
  const l = arr.length;
  for (let i = 0; i < l; i++) {
    if (predicate(arr[i])) {
      return i;
    }
  }
  return -1;
}

export function find(arr, predicate) {
    const index = findIndex(arr, predicate);
    return index === -1 ? undefined : arr[index];
}