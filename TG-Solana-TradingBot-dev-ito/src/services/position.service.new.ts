import prisma from "./prisma";

export const PositionService = {
  create: async (props: any) => {
    try {
      return await prisma.position.create({ data: props });
    } catch (err: any) {
      console.error("Error creating position:", err.message);
      throw new Error(err.message);
    }
  },
  findById: async (id: number) => {
    try {
      return await prisma.position.findUnique({ where: { id } });
    } catch (err: any) {
      console.error("Error finding position by id:", err.message);
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      return await prisma.position.findFirst({ where: props });
    } catch (err: any) {
      console.error("Error finding one position:", err.message);
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    try {
      return await prisma.position.findMany({ where: props });
    } catch (err: any) {
      console.error("Error finding positions:", err.message);
      throw new Error(err.message);
    }
  },
  updateOne: async (id: number, props: any) => {
    try {
      return await prisma.position.update({
        where: { id },
        data: props,
      });
    } catch (err: any) {
      console.error("Error updating position:", err.message);
      throw new Error(err.message);
    }
  },
  findAndUpdateOne: async (filter: any, props: any) => {
    try {
      const position = await prisma.position.findFirst({ where: filter });
      if (!position) return null;
      
      return await prisma.position.update({
        where: { id: position.id },
        data: props,
      });
    } catch (err: any) {
      console.error("Error finding and updating position:", err.message);
      throw new Error(err.message);
    }
  },
  updateMany: async (filter: any, props: any) => {
    try {
      return await prisma.position.updateMany({
        where: filter,
        data: props,
      });
    } catch (err: any) {
      console.error("Error updating many positions:", err.message);
      throw new Error(err.message);
    }
  },
  deleteOne: async (props: any) => {
    try {
      const position = await prisma.position.findFirst({ where: props });
      if (!position) return null;
      
      return await prisma.position.delete({ where: { id: position.id } });
    } catch (err: any) {
      console.error("Error deleting position:", err.message);
      throw new Error(err.message);
    }
  },
};
