import prisma from "./prisma";

export const MsgLogService = {
  create: async (props: any) => {
    try {
      return await prisma.msgLog.create({ data: props });
    } catch (err: any) {
      console.error("Error creating msglog:", err.message);
      throw new Error(err.message);
    }
  },
  findById: async (id: number) => {
    try {
      return await prisma.msgLog.findUnique({ where: { id } });
    } catch (err: any) {
      console.error("Error finding msglog by id:", err.message);
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      return await prisma.msgLog.findFirst({ where: props });
    } catch (err: any) {
      console.error("Error finding one msglog:", err.message);
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    try {
      return await prisma.msgLog.findMany({ where: props });
    } catch (err: any) {
      console.error("Error finding msglogs:", err.message);
      throw new Error(err.message);
    }
  },
  updateOne: async (id: number, props: any) => {
    try {
      return await prisma.msgLog.update({
        where: { id },
        data: props,
      });
    } catch (err: any) {
      console.error("Error updating msglog:", err.message);
      throw new Error(err.message);
    }
  },
  findAndUpdateOne: async (filter: any, props: any) => {
    try {
      const msglog = await prisma.msgLog.findFirst({ where: filter });
      if (!msglog) return null;
      
      return await prisma.msgLog.update({
        where: { id: msglog.id },
        data: props,
      });
    } catch (err: any) {
      console.error("Error finding and updating msglog:", err.message);
      throw new Error(err.message);
    }
  },
  updateMany: async (filter: any, props: any) => {
    try {
      return await prisma.msgLog.updateMany({
        where: filter,
        data: props,
      });
    } catch (err: any) {
      console.error("Error updating many msglogs:", err.message);
      throw new Error(err.message);
    }
  },
  deleteOne: async (props: any) => {
    try {
      const msglog = await prisma.msgLog.findFirst({ where: props });
      if (!msglog) return null;
      
      return await prisma.msgLog.delete({ where: { id: msglog.id } });
    } catch (err: any) {
      console.error("Error deleting msglog:", err.message);
      throw new Error(err.message);
    }
  },
};
