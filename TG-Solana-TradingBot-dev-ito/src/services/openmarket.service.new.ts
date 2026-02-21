import prisma from "./prisma";

export const OpenMarketService = {
  create: async (props: any) => {
    try {
      return await prisma.openMarket.create({ data: props });
    } catch (err: any) {
      console.error("Error creating openmarket:", err.message);
      throw new Error(err.message);
    }
  },
  findById: async (id: number) => {
    try {
      return await prisma.openMarket.findUnique({ where: { id } });
    } catch (err: any) {
      console.error("Error finding openmarket by id:", err.message);
      throw new Error(err.message);
    }
  },
  findOne: async (filter: any) => {
    try {
      return await prisma.openMarket.findFirst({ where: filter });
    } catch (err: any) {
      console.error("Error finding one openmarket:", err.message);
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    try {
      return await prisma.openMarket.findMany({ where: props });
    } catch (err: any) {
      console.error("Error finding openmarkets:", err.message);
      throw new Error(err.message);
    }
  },
  updateOne: async (filter: any, props: any) => {
    try {
      const openmarket = await prisma.openMarket.findFirst({ where: filter });
      if (!openmarket) {
        return await prisma.openMarket.create({ data: { ...filter, ...props } });
      }
      
      return await prisma.openMarket.update({
        where: { id: openmarket.id },
        data: props,
      });
    } catch (err: any) {
      console.error("Error updating openmarket:", err.message);
      throw new Error(err.message);
    }
  },
  updateMany: async (filter: any, props: any) => {
    try {
      return await prisma.openMarket.updateMany({
        where: filter,
        data: props,
      });
    } catch (err: any) {
      console.error("Error updating many openmarkets:", err.message);
      throw new Error(err.message);
    }
  },
  deleteOne: async (props: any) => {
    try {
      const openmarket = await prisma.openMarket.findFirst({ where: props });
      if (!openmarket) return null;
      
      return await prisma.openMarket.delete({ where: { id: openmarket.id } });
    } catch (err: any) {
      console.error("Error deleting openmarket:", err.message);
      throw new Error(err.message);
    }
  },
};
