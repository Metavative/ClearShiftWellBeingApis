import { Router } from "express";
import {
  listCompanyUsers,
  createCompanyUser,
  updateCompanyUser,
  deleteCompanyUser,
} from "../controllers/companyUserController.js";

const router = Router();

router.get("/", listCompanyUsers);
router.post("/", createCompanyUser);
router.patch("/:id", updateCompanyUser);
router.delete("/:id", deleteCompanyUser);

export default router;
