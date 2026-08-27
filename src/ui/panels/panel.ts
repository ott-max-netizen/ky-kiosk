export interface Panel<T> {
  mount(): void;
  update(value: T): void;
  /**
   * Valikuline ajapõhine uuendus. Kõik paneelid kasutavad sama Date-sisendit,
   * et ajavööndi- ja elutsükliloogika ei muutuks paneeliti eri tüüpi kokkuleppeks.
   */
  tick?(now: Date): void;
  destroy(): void;
}
