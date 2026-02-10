import { Router, type RequestHandler } from "express";
import { respondWithError } from "../../shared/http.js";
import { ArticlesService } from "./articles.service.js";

export function createArticlesRouter(articlesService: ArticlesService): Router {
  const router = Router();

  const listArticles: RequestHandler = (_req, res) => {
    try {
      res.json(articlesService.listArticles());
    } catch (error) {
      respondWithError(res, error);
    }
  };

  const createArticle: RequestHandler = (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title : "";
    const content = typeof req.body?.content === "string" ? req.body.content : "";
    const excerpt = typeof req.body?.excerpt === "string" ? req.body.excerpt : "";
    const coverUrl = typeof req.body?.coverUrl === "string" ? req.body.coverUrl : "";
    const status = typeof req.body?.status === "string" ? req.body.status : "DRAFT";
    const authorId = typeof req.body?.authorId === "string" ? req.body.authorId : "";

    try {
      const article = articlesService.createArticle({
        title,
        content,
        excerpt,
        coverUrl,
        status,
        authorId,
      });

      res.status(201).json(article);
    } catch (error) {
      respondWithError(res, error);
    }
  };

  router.get("/", listArticles);
  router.post("/", createArticle);

  return router;
}
