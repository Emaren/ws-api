import { Router, type RequestHandler } from "express";
import { HttpError } from "../../shared/http-error.js";
import { respondWithError } from "../../shared/http.js";
import { normalizeRole } from "../../shared/rbac.js";
import { ArticlesService } from "./articles.service.js";
import type { ArticlePrincipal } from "./articles.service.js";

interface ArticlesRouteGuards {
  requireSession?: RequestHandler;
  resolveSession?: RequestHandler;
  requireEditorial?: RequestHandler;
}

function optionalPrincipalFromResponseLocals(locals: Record<string, unknown>): ArticlePrincipal | undefined {
  const principal =
    typeof locals.principal === "object" && locals.principal !== null
      ? (locals.principal as { user?: { id?: string; role?: string } })
      : undefined;

  const userId = principal?.user?.id;
  const role = normalizeRole(principal?.user?.role);

  if (typeof userId !== "string" || !role) {
    return undefined;
  }

  return {
    userId,
    role,
  };
}

function requiredPrincipalFromResponseLocals(locals: Record<string, unknown>): ArticlePrincipal {
  const principal = optionalPrincipalFromResponseLocals(locals);
  if (!principal) {
    throw new HttpError(401, "Authentication required");
  }

  return principal;
}

export function createArticlesRouter(
  articlesService: ArticlesService,
  guards?: ArticlesRouteGuards,
): Router {
  const router = Router();

  const listArticles: RequestHandler = (_req, res) => {
    try {
      const principal = optionalPrincipalFromResponseLocals(res.locals);
      res.json(articlesService.listArticles(principal));
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const getArticleBySlug: RequestHandler = (req, res) => {
    const slug = typeof req.params.slug === "string" ? req.params.slug : "";

    try {
      if (!slug.trim()) {
        throw new HttpError(400, "Missing article slug");
      }

      const principal = optionalPrincipalFromResponseLocals(res.locals);
      res.json(articlesService.getArticleBySlug(slug, principal));
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const createArticle: RequestHandler = (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title : "";
    const content = typeof req.body?.content === "string" ? req.body.content : "";
    const excerpt = typeof req.body?.excerpt === "string" ? req.body.excerpt : "";
    const coverUrl = typeof req.body?.coverUrl === "string" ? req.body.coverUrl : "";
    const status = typeof req.body?.status === "string" ? req.body.status : undefined;

    try {
      const principal = requiredPrincipalFromResponseLocals(res.locals);
      const article = articlesService.createArticle({
        title,
        content,
        excerpt,
        coverUrl,
        status,
      }, principal);

      res.status(201).json(article);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const updateArticle: RequestHandler = (req, res) => {
    const slug = typeof req.params.slug === "string" ? req.params.slug : "";
    const title = typeof req.body?.title === "string" ? req.body.title : undefined;
    const nextSlug = typeof req.body?.slug === "string" ? req.body.slug : undefined;
    const content = typeof req.body?.content === "string" ? req.body.content : undefined;
    const excerpt =
      typeof req.body?.excerpt === "string" || req.body?.excerpt === null
        ? req.body.excerpt
        : undefined;
    const coverUrl =
      typeof req.body?.coverUrl === "string" || req.body?.coverUrl === null
        ? req.body.coverUrl
        : undefined;
    const status = typeof req.body?.status === "string" ? req.body.status : undefined;

    try {
      if (!slug.trim()) {
        throw new HttpError(400, "Missing article slug");
      }

      const principal = requiredPrincipalFromResponseLocals(res.locals);
      const updated = articlesService.updateArticleBySlug(
        slug,
        {
          title,
          slug: nextSlug,
          content,
          excerpt,
          coverUrl,
          status,
        },
        principal,
      );
      res.json(updated);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const deleteArticle: RequestHandler = (req, res) => {
    const slug = typeof req.params.slug === "string" ? req.params.slug : "";

    try {
      if (!slug.trim()) {
        throw new HttpError(400, "Missing article slug");
      }

      const principal = requiredPrincipalFromResponseLocals(res.locals);
      articlesService.deleteArticleBySlug(slug, principal);
      res.status(204).send();
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const maybeResolveSession = guards?.resolveSession;
  if (maybeResolveSession) {
    router.get("/", maybeResolveSession, listArticles);
    router.get("/:slug", maybeResolveSession, getArticleBySlug);
  } else {
    router.get("/", listArticles);
    router.get("/:slug", getArticleBySlug);
  }

  if (guards?.requireSession && guards?.requireEditorial) {
    router.post("/", guards.requireSession, guards.requireEditorial, createArticle);
    router.patch("/:slug", guards.requireSession, guards.requireEditorial, updateArticle);
    router.delete("/:slug", guards.requireSession, guards.requireEditorial, deleteArticle);
  } else if (guards?.requireEditorial) {
    router.post("/", guards.requireEditorial, createArticle);
    router.patch("/:slug", guards.requireEditorial, updateArticle);
    router.delete("/:slug", guards.requireEditorial, deleteArticle);
  } else {
    router.post("/", createArticle);
    router.patch("/:slug", updateArticle);
    router.delete("/:slug", deleteArticle);
  }

  return router;
}
