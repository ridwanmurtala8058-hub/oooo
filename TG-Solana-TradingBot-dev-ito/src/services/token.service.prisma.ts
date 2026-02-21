import prisma from "./prisma";

export const TokenService = {
  create: async (props: any) => {
    try {
      return await prisma.token.create({ data: props });
    } catch (err: any) {
      console.error("Error creating token:", err.message);
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      return await prisma.token.findFirst({ where: props });
    } catch (err: any) {
      console.error("Error finding one token:", err.message);
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    try {
      return await prisma.token.findMany({ where: props });
    } catch (err: any) {
      console.error("Error finding tokens:", err.message);
      throw new Error(err.message);
    }
  },
  updateOne: async (filter: any, props: any) => {
    try {
      const token = await prisma.token.findFirst({ where: filter });
      if (!token) {
        return await prisma.token.create({ data: { ...filter, ...props } });
      }
      
      return await prisma.token.update({
        where: { id: token.id },
        data: props,
      });
    } catch (err: any) {
      console.error("Error updating token:", err.message);
      throw new Error(err.message);
    }
  },
  findAndUpdateOne: async (filter: any, props: any) => {
    try {
      const token = await prisma.token.findFirst({ where: filter });
      if (!token) return null;
      
      return await prisma.token.update({
        where: { id: token.id },
        data: props,
      });
    } catch (err: any) {
      console.error("Error finding and updating token:", err.message);
      throw new Error(err.message);
    }
  },
  deleteOne: async (props: any) => {
    try {
      const token = await prisma.token.findFirst({ where: props });
      if (!token) return null;
      
      return await prisma.token.delete({ where: { id: token.id } });
    } catch (err: any) {
      console.error("Error deleting token:", err.message);
      throw new Error(err.message);
    }
  },
};
