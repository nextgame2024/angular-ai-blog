import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { articleActions } from '../store/actions';
import {
  selectArticleData,
  selectError,
  selectIsLoading,
} from '../store/reducers';
import { selectCurrentUser } from 'src/app/auth/store/reducers';
import { CommonModule, DOCUMENT } from '@angular/common';
import { LoadingComponent } from 'src/app/shared/components/loading/loading.component';
import { ErrorMessageComponent } from 'src/app/shared/components/errorMessage/errorMessage.component';
import { TagListComponent } from 'src/app/shared/components/tagList/tagList.component';
import { RenderService } from 'src/app/shared/services/render.service';
import { firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

/* PrimeNG */
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ArticleMediaComponent } from 'src/app/shared/components/articleMedia/articleMedia.component';

@Component({
    selector: 'mc-article',
    templateUrl: './article.component.html',
    imports: [
        CommonModule,
        RouterLink,
        LoadingComponent,
        ErrorMessageComponent,
        TagListComponent,
        AvatarModule,
        ButtonModule,
        ConfirmDialogModule,
        ArticleMediaComponent,
    ],
    providers: [ConfirmationService]
})
export class ArticleComponent {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmation = inject(ConfirmationService);
  private readonly render = inject(RenderService);
  private readonly document = inject(DOCUMENT);

  private readonly paramMap$$ = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly slug$$ = computed(() => this.paramMap$$().get('slug') ?? '');
  private readonly lastSlug$$ = signal<string | null>(null);

  readonly guestEmail$$ = signal('');

  readonly defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';

  getAuthorImage(
    article: { author?: { image?: string | null } } | null | undefined
  ): string {
    return article?.author?.image || this.defaultAvatar;
  }

  readonly article$$ = toSignal(this.store.select(selectArticleData), {
    initialValue: null,
  });
  readonly error$$ = toSignal(this.store.select(selectError), {
    initialValue: null,
  });
  readonly isLoading$$ = toSignal(this.store.select(selectIsLoading), {
    initialValue: false,
  });
  readonly currentUser$$ = toSignal(this.store.select(selectCurrentUser), {
    initialValue: null,
  });

  readonly isAuthor$$ = computed(() => {
    const article = this.article$$();
    const currentUser = this.currentUser$$();
    if (!article || !currentUser) return false;
    return article.author.username === currentUser.username;
  });

  private readonly loadEffect = effect(() => {
    const slug = this.slug$$();
    if (!slug) return;
    if (this.lastSlug$$() === slug) return;
    this.lastSlug$$.set(slug);
    this.store.dispatch(articleActions.getArticle({ slug }));
  });

  deleteArticle(): void {
    const slug = this.slug$$();
    if (!slug) return;
    this.store.dispatch(articleActions.deleteArticle({ slug }));
  }

  confirmDelete(): void {
    this.confirmation.confirm({
      message: 'Delete this article? This action cannot be undone.',
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.deleteArticle(),
    });
  }

  readonly selectedFile$$ = signal<File | null>(null);
  readonly selectedFileName$$ = signal('');
  readonly uploadError$$ = signal('');
  readonly creatingCheckout$$ = signal(false);

  onFileSelected(evt: Event): void {
    this.uploadError$$.set('');
    this.selectedFile$$.set(null);
    this.selectedFileName$$.set('');

    const input = evt.target instanceof HTMLInputElement ? evt.target : null;
    const file = input?.files?.[0];
    if (!file) return;

    const isImage = /^image\//.test(file.type);
    const under10MB = file.size <= 10 * 1024 * 1024;

    if (!isImage) {
      this.uploadError$$.set('Please select an image (JPG, PNG, HEIC).');
      return;
    }
    if (!under10MB) {
      this.uploadError$$.set('File too large (max 10 MB).');
      return;
    }

    this.selectedFile$$.set(file);
    this.selectedFileName$$.set(file.name);
  }

  async onGenerateRequested(): Promise<void> {
    const selectedFile = this.selectedFile$$();
    const uploadError = this.uploadError$$();
    if (!selectedFile || uploadError) return;

    // if not logged in, require email
    const isLoggedIn = !!this.currentUser$$();
    if (!isLoggedIn && !this.guestEmail$$()) {
      this.uploadError$$.set(
        'Please enter an email address to receive your video.'
      );
      return;
    }

    this.creatingCheckout$$.set(true);
    try {
      const resp = await firstValueFrom(
        this.render.createSession(
          selectedFile.name,
          selectedFile.type,
          this.slug$$(), // current article slug
          isLoggedIn ? undefined : this.guestEmail$$()
        )
      );
      if (!resp?.uploadUrl || !resp?.sessionUrl)
        throw new Error('Invalid server response');
      await this.render.uploadToS3(resp.uploadUrl, selectedFile);
      this.document.defaultView?.location.assign(resp.sessionUrl);
    } catch (e) {
      this.uploadError$$.set('Could not start checkout. Please try again.');
    } finally {
      this.creatingCheckout$$.set(false);
    }
  }
}
