export interface Panel<T> {
  mount(): void;
  update(value: T): void;
  destroy(): void;
}
