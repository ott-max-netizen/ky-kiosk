/**
 * Väike loendi-lepitaja roteeruvatele paneelidele.
 *
 * Paneelid ehitasid varem iga pöörde peal kogu sisu uuesti: `clearElement` ja
 * seejärel uued elemendid. Ekraanil paistab tulemus sama, aga 8- ja
 * 18-sekundilise rotatsiooni juures tähendab see sadu tuhandeid elemendi-
 * eraldusi ööpäevas, mille prügikoristaja peab hiljem kokku korjama. Kiosk
 * töötab nädalaid järjest, nii et see kulu koguneb.
 *
 * Lepitaja hoiab olemasolevad read alles, loob ainult puuduva, eemaldab ainult
 * ülearuse ja laseb `render`-il rea kohapeal ära täita. Koos `setText`-i ja
 * `patchAttribute`-ga, mis kirjutavad ainult tegeliku muutuse korral, jääb
 * püsiseisundis DOM-i puutumata.
 */
export function reconcileChildren<T>(
  container: HTMLElement,
  items: readonly T[],
  create: () => HTMLElement,
  render: (element: HTMLElement, item: T, index: number) => void,
): void {
  const children = container.children;
  for (let index = 0; index < items.length; index += 1) {
    let element = children[index] as HTMLElement | undefined;
    if (!element) {
      element = create();
      container.appendChild(element);
    }
    render(element, items[index] as T, index);
  }
  while (children.length > items.length) container.lastElementChild?.remove();
}

/**
 * Hoiab konteineris täpselt `count` ühesugust last ja tagastab need. Kasutusel
 * seal, kus lapsed on üksteisest eristamatud (lehekülje punktid, vaateindikaator).
 */
export function reconcileCount(
  container: HTMLElement,
  count: number,
  create: () => HTMLElement,
): HTMLElement[] {
  const children = container.children;
  while (children.length < count) container.appendChild(create());
  while (children.length > count) container.lastElementChild?.remove();
  return [...children] as HTMLElement[];
}
