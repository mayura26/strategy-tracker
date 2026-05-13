export function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

export function assertApprox(
  actual: number,
  expected: number,
  label: string,
  epsilon = 0.00001,
) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

export function assertOk(value: boolean, label: string) {
  if (!value) {
    throw new Error(`${label}: assertion failed`);
  }
}
