import {
  Directive,
  ElementRef,
  NgZone,
  effect,
  inject,
  input,
  output,
} from '@angular/core';

@Directive({
  selector: '[ioObserve]',
  standalone: true,
})
export class IoObserverDirective {
  readonly root$$ = input<Element | null>(null, { alias: 'root' });
  readonly rootMargin$$ = input('0px', { alias: 'rootMargin' });
  readonly threshold$$ = input<number | number[]>(0, { alias: 'threshold' });
  readonly ioIntersect = output<IntersectionObserverEntry>();

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  private readonly observerEffect = effect((onCleanup) => {
    const root = this.root$$();
    const rootMargin = this.rootMargin$$();
    const threshold = this.threshold$$();
    let io: IntersectionObserver | undefined;

    this.zone.runOutsideAngular(() => {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              // Re-enter Angular only when intersecting
              this.zone.run(() => this.ioIntersect.emit(entry));
            }
          }
        },
        {
          root,
          rootMargin,
          threshold,
        }
      );
      io.observe(this.el.nativeElement);
    });

    onCleanup(() => io?.disconnect());
  });
}
