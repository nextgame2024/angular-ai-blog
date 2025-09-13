import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { articleActions } from '../store/actions';
import { combineLatest, filter, map } from 'rxjs';
import {
  selectArticleData,
  selectError,
  selectIsLoading,
} from '../store/reducers';
import { selectCurrentUser } from 'src/app/auth/store/reducers';
import { CurrentUserInterface } from 'src/app/shared/types/currentUser.interface';
import { CommonModule } from '@angular/common';
import { LoadingComponent } from 'src/app/shared/components/loading/loading.component';
import { ErrorMessageComponent } from 'src/app/shared/components/errorMessage/errorMessage.component';
import { TagListComponent } from 'src/app/shared/components/tagList/tagList.component';
import { RenderService } from 'src/app/shared/services/render.service';
import { firstValueFrom } from 'rxjs';

/* PrimeNG */
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { FooterComponent } from 'src/app/shared/components/footer/footer.component';
import { ArticleMediaComponent } from 'src/app/shared/components/articleMedia/articleMedia.component';

@Component({
  selector: 'mc-article',
  templateUrl: './article.component.html',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LoadingComponent,
    ErrorMessageComponent,
    TagListComponent,
    AvatarModule,
    ButtonModule,
    ConfirmDialogModule,
    FooterComponent,
    ArticleMediaComponent,
  ],
  providers: [ConfirmationService],
})
export class ArticleComponent implements OnInit {
  slug = this.route.snapshot.paramMap.get('slug') ?? '';

  defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';

  getAuthorImage(
    article: { author?: { image?: string | null } } | null | undefined
  ): string {
    return article?.author?.image || this.defaultAvatar;
  }

  isAuthor$ = combineLatest({
    article: this.store.select(selectArticleData),
    currentUser: this.store
      .select(selectCurrentUser)
      .pipe(
        filter(
          (currentUser): currentUser is CurrentUserInterface | null =>
            currentUser !== undefined
        )
      ),
  }).pipe(
    map(({ article, currentUser }) => {
      if (!article || !currentUser) return false;
      return article.author.username === currentUser.username;
    })
  );

  data$ = combineLatest({
    isLoading: this.store.select(selectIsLoading),
    error: this.store.select(selectError),
    article: this.store.select(selectArticleData),
    isAuthor: this.isAuthor$,
  });

  constructor(
    private store: Store,
    private route: ActivatedRoute,
    private confirmation: ConfirmationService,
    private render: RenderService
  ) {}

  ngOnInit(): void {
    this.store.dispatch(articleActions.getArticle({ slug: this.slug }));
  }

  deleteArticle(): void {
    this.store.dispatch(articleActions.deleteArticle({ slug: this.slug }));
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

  selectedFile: File | null = null;
  selectedFileName = '';
  uploadError = '';
  creatingCheckout = false;

  onFileSelected(evt: Event): void {
    this.uploadError = '';
    this.selectedFile = null;
    this.selectedFileName = '';

    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isImage = /^image\//.test(file.type);
    const under10MB = file.size <= 10 * 1024 * 1024;

    if (!isImage) {
      this.uploadError = 'Please select an image (JPG, PNG, HEIC).';
      return;
    }
    if (!under10MB) {
      this.uploadError = 'File too large (max 10 MB).';
      return;
    }

    this.selectedFile = file;
    this.selectedFileName = file.name;
  }

  async onGenerateRequested(): Promise<void> {
    if (!this.selectedFile || this.uploadError) return;

    this.creatingCheckout = true;
    try {
      const resp = await firstValueFrom(
        this.render.createSession(
          this.selectedFile.name,
          this.selectedFile.type
        )
      );

      if (!resp?.uploadUrl || !resp?.sessionUrl) {
        throw new Error('Invalid response from server');
      }

      await this.render.uploadToS3(resp.uploadUrl, this.selectedFile);
      window.location.href = resp.sessionUrl;
    } catch (e) {
      console.error(e);
      this.uploadError = 'Could not start checkout. Please try again.';
    } finally {
      this.creatingCheckout = false;
    }
  }
}
