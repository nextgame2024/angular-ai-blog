import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';

@Directive({
  selector: '[ioObserve]',
  standalone: true,
})
export class IoObserverDirective implements OnInit, OnDestroy {
  @Input() root: Element | null = null;
  @Input() rootMargin = '0px';
  @Input() threshold: number | number[] = 0;
  @Output() ioIntersect = new EventEmitter<IntersectionObserverEntry>();

  private io?: IntersectionObserver;

  constructor(private el: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      this.io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              // Re-enter Angular only when intersecting
              this.zone.run(() => this.ioIntersect.emit(entry));
            }
          }
        },
        {
          root: this.root,
          rootMargin: this.rootMargin,
          threshold: this.threshold,
        }
      );
      this.io.observe(this.el.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
  }
}
