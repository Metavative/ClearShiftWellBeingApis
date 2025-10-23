import { Router } from "express";
import {
  createAdmin,
  listAdmins,
  getAdmin,
  updateAdmin,
  deleteAdmin,
  rotateLicense,
  revokeLicense,
} from "../controllers/adminController.js";
// import { requireAuth } from "../middleware/auth.js";

const router = Router();

// router.use(requireAuth); // enable when you’re ready

router.get("/", listAdmins);
router.post("/", createAdmin);
router.get("/:id", getAdmin);
router.patch("/:id", updateAdmin);
router.delete("/:id", deleteAdmin);

// license ops
router.post("/:id/license/rotate", rotateLicense);
router.post("/:id/license/revoke", revokeLicense);

export default router;
