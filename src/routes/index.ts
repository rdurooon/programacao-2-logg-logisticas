import { Router } from "express";
import userRoutes from "./user.route";
import authRoutes from "./auth.route";
import packageRoutes from "./package.route";
import clienteRoutes from "./cliente.route";
import addressRoutes from "./address.route";
const routes = Router();

routes.use("/users", userRoutes);
routes.use("/auth", authRoutes);
routes.use("/package", packageRoutes)
routes.use("/clientes", clienteRoutes);
routes.use("/enderecos", addressRoutes);

routes.get("/", (req, res) => {
  res.json({ message: "Store API - Node.js + Express + TypeScript" });
});

export default routes;