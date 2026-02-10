import { HttpError } from "../../shared/http-error.js";
import type { ArticleRecord, ArticleStatus, UserRole } from "../../shared/models.js";
import type { ArticlesRepository } from "./articles.repository.js";

interface CreateArticleInput {
  title: string;
  content: string;
  excerpt: string;
  coverUrl: string;
  status?: string;
}

interface UpdateArticleInput {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  status?: string;
}

export interface ArticlePrincipal {
  userId: string;
  role: UserRole;
}

const ARTICLE_STATUS_TRANSITIONS: Record<ArticleStatus, readonly ArticleStatus[]> = {
  DRAFT: ["REVIEW", "ARCHIVED"],
  REVIEW: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeStatus(input: string | undefined): ArticleStatus | undefined {
  if (!input) {
    return undefined;
  }

  const value = input.trim().toUpperCase();
  if (value === "DRAFT" || value === "REVIEW" || value === "PUBLISHED" || value === "ARCHIVED") {
    return value;
  }

  return undefined;
}

function isStaffRole(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "EDITOR";
}

function isEditorialRole(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "EDITOR" || role === "CONTRIBUTOR";
}

function canContributorTransition(from: ArticleStatus, to: ArticleStatus): boolean {
  return (from === "DRAFT" && to === "REVIEW") || (from === "REVIEW" && to === "DRAFT");
}

export class ArticlesService {
  constructor(private readonly articlesRepository: ArticlesRepository) {}

  listArticles(principal?: ArticlePrincipal): ArticleRecord[] {
    const allArticles = this.articlesRepository.list();
    if (!principal) {
      return allArticles.filter((article) => article.status === "PUBLISHED");
    }

    if (isStaffRole(principal.role)) {
      return allArticles;
    }

    if (principal.role === "CONTRIBUTOR") {
      return allArticles.filter(
        (article) => article.status === "PUBLISHED" || article.authorId === principal.userId,
      );
    }

    return allArticles.filter((article) => article.status === "PUBLISHED");
  }

  getArticleBySlug(slug: string, principal?: ArticlePrincipal): ArticleRecord {
    const article = this.articlesRepository.findBySlug(slug);
    if (!article) {
      throw new HttpError(404, "Article not found");
    }

    if (article.status === "PUBLISHED") {
      return article;
    }

    if (!principal) {
      throw new HttpError(404, "Article not found");
    }

    if (isStaffRole(principal.role)) {
      return article;
    }

    if (principal.role === "CONTRIBUTOR" && article.authorId === principal.userId) {
      return article;
    }

    throw new HttpError(403, "Insufficient role permissions");
  }

  createArticle(input: CreateArticleInput, principal: ArticlePrincipal): ArticleRecord {
    if (!isEditorialRole(principal.role)) {
      throw new HttpError(403, "Insufficient role permissions");
    }

    if (!input.title.trim() || !input.content.trim()) {
      throw new HttpError(400, "Missing title or content");
    }

    const baseSlug = slugify(input.title) || "article";
    let slug = baseSlug;
    let suffix = 2;
    while (this.articlesRepository.findBySlug(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const normalizedStatus = normalizeStatus(input.status);
    if (input.status !== undefined && !normalizedStatus) {
      throw new HttpError(400, "Invalid article status");
    }

    const status = normalizedStatus ?? "DRAFT";
    if (principal.role === "CONTRIBUTOR" && (status === "PUBLISHED" || status === "ARCHIVED")) {
      throw new HttpError(403, "Contributors cannot publish or archive directly");
    }

    return this.articlesRepository.create({
      title: input.title.trim(),
      slug,
      content: input.content,
      excerpt: input.excerpt.trim() || null,
      coverUrl: input.coverUrl.trim() || null,
      status,
      authorId: principal.userId,
    });
  }

  updateArticleBySlug(
    slug: string,
    input: UpdateArticleInput,
    principal: ArticlePrincipal,
  ): ArticleRecord {
    if (!isEditorialRole(principal.role)) {
      throw new HttpError(403, "Insufficient role permissions");
    }

    const article = this.articlesRepository.findBySlug(slug);
    if (!article) {
      throw new HttpError(404, "Article not found");
    }

    const isOwner = article.authorId === principal.userId;
    const isStaff = isStaffRole(principal.role);
    if (!isStaff && principal.role === "CONTRIBUTOR" && !isOwner) {
      throw new HttpError(403, "Cannot edit another contributor's article");
    }

    const nextStatus = normalizeStatus(input.status);
    if (input.status !== undefined && !nextStatus) {
      throw new HttpError(400, "Invalid article status");
    }

    if (nextStatus && nextStatus !== article.status) {
      if (isStaff) {
        const allowed = ARTICLE_STATUS_TRANSITIONS[article.status];
        if (!allowed.includes(nextStatus)) {
          throw new HttpError(
            409,
            `Invalid status transition: ${article.status} -> ${nextStatus}`,
          );
        }
      } else if (principal.role === "CONTRIBUTOR") {
        if (!isOwner || !canContributorTransition(article.status, nextStatus)) {
          throw new HttpError(403, "Contributors can only move own drafts between DRAFT and REVIEW");
        }
      } else {
        throw new HttpError(403, "Insufficient role permissions");
      }
    }

    let requestedSlug: string | undefined;
    if (input.slug !== undefined) {
      const normalizedSlug = slugify(input.slug);
      if (!normalizedSlug) {
        throw new HttpError(400, "Invalid slug");
      }
      requestedSlug = normalizedSlug;
    }

    if (requestedSlug && requestedSlug !== slug) {
      const collision = this.articlesRepository.findBySlug(requestedSlug);
      if (collision) {
        throw new HttpError(409, "Slug already in use");
      }
    }

    const hasContentPatch =
      input.title !== undefined ||
      input.content !== undefined ||
      input.excerpt !== undefined ||
      input.coverUrl !== undefined ||
      requestedSlug !== undefined;

    if (hasContentPatch && !isStaff) {
      if (principal.role !== "CONTRIBUTOR" || !isOwner) {
        throw new HttpError(403, "Insufficient role permissions");
      }

      if (article.status !== "DRAFT" && article.status !== "REVIEW") {
        throw new HttpError(
          403,
          "Contributors can only edit own articles while in DRAFT or REVIEW",
        );
      }
    }

    if (input.title !== undefined && !input.title.trim()) {
      throw new HttpError(400, "Title cannot be empty");
    }

    if (input.content !== undefined && !input.content.trim()) {
      throw new HttpError(400, "Content cannot be empty");
    }

    const patch: Parameters<ArticlesRepository["updateBySlug"]>[1] = {};

    if (input.title !== undefined) {
      patch.title = input.title.trim();
    }
    if (requestedSlug !== undefined) {
      patch.slug = requestedSlug;
    }
    if (input.content !== undefined) {
      patch.content = input.content;
    }
    if (input.excerpt !== undefined) {
      patch.excerpt = input.excerpt === null ? null : input.excerpt.trim() || null;
    }
    if (input.coverUrl !== undefined) {
      patch.coverUrl = input.coverUrl === null ? null : input.coverUrl.trim() || null;
    }
    if (nextStatus !== undefined) {
      patch.status = nextStatus;
      if (nextStatus === "PUBLISHED") {
        patch.publishedAt = article.publishedAt ?? new Date().toISOString();
      } else if (nextStatus === "ARCHIVED") {
        patch.publishedAt = article.publishedAt;
      } else {
        patch.publishedAt = null;
      }
    }

    if (Object.keys(patch).length === 0) {
      throw new HttpError(400, "No changes supplied");
    }

    const updated = this.articlesRepository.updateBySlug(slug, patch);
    if (!updated) {
      throw new HttpError(404, "Article not found");
    }

    return updated;
  }

  deleteArticleBySlug(slug: string, principal: ArticlePrincipal): { deleted: true } {
    if (!isEditorialRole(principal.role)) {
      throw new HttpError(403, "Insufficient role permissions");
    }

    const article = this.articlesRepository.findBySlug(slug);
    if (!article) {
      throw new HttpError(404, "Article not found");
    }

    const isOwner = article.authorId === principal.userId;
    const isStaff = isStaffRole(principal.role);
    const canDeleteAsContributor =
      principal.role === "CONTRIBUTOR" &&
      isOwner &&
      (article.status === "DRAFT" || article.status === "REVIEW");

    if (!isStaff && !canDeleteAsContributor) {
      throw new HttpError(403, "Insufficient role permissions");
    }

    const removed = this.articlesRepository.deleteBySlug(slug);
    if (!removed) {
      throw new HttpError(404, "Article not found");
    }

    return { deleted: true };
  }
}
