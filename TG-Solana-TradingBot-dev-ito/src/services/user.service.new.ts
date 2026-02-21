import prisma from "./prisma";

export const UserService = {
  create: async (props: any) => {
    try {
      return await prisma.user.create({ data: props });
    } catch (err: any) {
      console.error("Error creating user:", err.message);
      // If DB is unavailable, return null so callers can degrade gracefully
      if (err?.message?.includes('Can't reach database server') || err?.code === 'P1001') {
        return null;
      }
      throw new Error(err.message);
    }
  },
  findById: async (props: any) => {
    try {
      const { id } = props;
      return await prisma.user.findUnique({ where: { id } });
    } catch (err: any) {
      console.error("Error finding user by id:", err.message);
      if (err?.message?.includes('Can\'t reach database server') || err?.code === 'P1001') {
        return null;
      }
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      // Remove retired from filter and add it as a where clause
      const filter = { ...props, retired: false };
      return await prisma.user.findFirst({ where: filter });
    } catch (err: any) {
      console.error("Error finding one user:", err.message);
      if (err?.message?.includes('Can\'t reach database server') || err?.code === 'P1001') {
        return null;
      }
      throw new Error(err.message);
    }
  },
  findLastOne: async (props: any) => {
    try {
      const result = await prisma.user.findFirst({
        where: props,
        orderBy: { updatedAt: 'desc' },
      });
      return result;
    } catch (err: any) {
      console.error("Error finding last user:", err.message);
      if (err?.message?.includes('Can\'t reach database server') || err?.code === 'P1001') {
        return null;
      }
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    try {
      return await prisma.user.findMany({ where: props });
    } catch (err: any) {
      console.error("Error finding users:", err.message);
      if (err?.message?.includes('Can\'t reach database server') || err?.code === 'P1001') {
        return [];
      }
      throw new Error(err.message);
    }
  },
  findAndSort: async (props: any) => {
    try {
      return await prisma.user.findMany({
        where: props,
        orderBy: [{ retired: 'asc' }, { nonce: 'asc' }],
      });
    } catch (err: any) {
      console.error("Error finding and sorting users:", err.message);
      if (err?.message?.includes('Can\'t reach database server') || err?.code === 'P1001') {
        return [];
      }
      throw new Error(err.message);
    }
  },
  updateOne: async (props: any) => {
    const { id, ...data } = props;
    try {
      return await prisma.user.update({
        where: { id },
        data,
      });
    } catch (err: any) {
      console.error("Error updating user:", err.message);
      if (err?.message?.includes('Can\'t reach database server') || err?.code === 'P1001') {
        return null;
      }
      throw new Error(err.message);
    }
  },
  findAndUpdateOne: async (filter: any, props: any) => {
    try {
      // Find the first user matching the filter
      const user = await prisma.user.findFirst({ where: filter });
      if (!user) return null;
      
      return await prisma.user.update({
        where: { id: user.id },
        data: props,
      });
    } catch (err: any) {
      console.error("Error finding and updating user:", err.message);
      if (err?.message?.includes('Can\'t reach database server') || err?.code === 'P1001') {
        return null;
      }
      throw new Error(err.message);
    }
  },
  updateMany: async (filter: any, props: any) => {
    try {
      return await prisma.user.updateMany({
        where: filter,
        data: props,
      });
    } catch (err: any) {
      console.error("Error updating many users:", err.message);
      if (err?.message?.includes('Can\'t reach database server') || err?.code === 'P1001') {
        return null;
      }
      throw new Error(err.message);
    }
  },
  deleteOne: async (props: any) => {
    try {
      const user = await prisma.user.findFirst({ where: props });
      if (!user) return null;
      
      return await prisma.user.delete({ where: { id: user.id } });
    } catch (err: any) {
      console.error("Error deleting user:", err.message);
      if (err?.message?.includes('Can\'t reach database server') || err?.code === 'P1001') {
        return null;
      }
      throw new Error(err.message);
    }
  },
  extractUniqueCode: (text: string): string | null => {
    const words = text.split(' ');
    return words.length > 1 ? words[1] : null;
  },
};
