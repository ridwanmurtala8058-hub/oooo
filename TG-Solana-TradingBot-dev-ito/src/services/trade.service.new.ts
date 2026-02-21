import prisma from "./prisma";

export const TradeService = {
  create: async (props: any) => {
    try {
      return await prisma.trade.create({ data: props });
    } catch (err: any) {
      console.error("Error creating trade:", err.message);
      throw new Error(err.message);
    }
  },
  findById: async (id: number) => {
    try {
      return await prisma.trade.findUnique({ where: { id } });
    } catch (err: any) {
      console.error("Error finding trade by id:", err.message);
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      return await prisma.trade.findFirst({ where: props });
    } catch (err: any) {
      console.error("Error finding one trade:", err.message);
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    try {
      return await prisma.trade.findMany({ where: props });
    } catch (err: any) {
      console.error("Error finding trades:", err.message);
      throw new Error(err.message);
    }
  },
  updateOne: async (id: number, props: any) => {
    try {
      return await prisma.trade.update({
        where: { id },
        data: props,
      });
    } catch (err: any) {
      console.error("Error updating trade:", err.message);
      throw new Error(err.message);
    }
  },
  findAndUpdateOne: async (filter: any, props: any) => {
    try {
      const trade = await prisma.trade.findFirst({ where: filter });
      if (!trade) return null;
      
      return await prisma.trade.update({
        where: { id: trade.id },
        data: props,
      });
    } catch (err: any) {
      console.error("Error finding and updating trade:", err.message);
      throw new Error(err.message);
    }
  },
  updateMany: async (filter: any, props: any) => {
    try {
      return await prisma.trade.updateMany({
        where: filter,
        data: props,
      });
    } catch (err: any) {
      console.error("Error updating many trades:", err.message);
      throw new Error(err.message);
    }
  },
  deleteOne: async (props: any) => {
    try {
      const trade = await prisma.trade.findFirst({ where: props });
      if (!trade) return null;
      
      return await prisma.trade.delete({ where: { id: trade.id } });
    } catch (err: any) {
      console.error("Error deleting trade:", err.message);
      throw new Error(err.message);
    }
  },
};
