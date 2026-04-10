import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'mc-error-message',
  template: '<div>{{ displayMessage$$() }}</div>',
  standalone: true,
})
export class ErrorMessageComponent {
  readonly message$$ = input<string | null | undefined>(null, {
    alias: 'message',
  });
  readonly displayMessage$$ = computed(
    () => this.message$$() || 'Something went wrong',
  );
}
