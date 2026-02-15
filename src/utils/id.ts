let slideCounter = 100;
let elementCounter = 100;

export function nextSlideId(): string {
  return `s${slideCounter++}`;
}

export function nextElementId(): string {
  return `e${elementCounter++}`;
}
