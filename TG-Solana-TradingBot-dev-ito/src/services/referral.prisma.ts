import prisma from "./prisma";

export const ReferralChannelService = {
  create: async (props: any) => {
    try {
      return await prisma.referralChannel.create({ data: props });
    } catch (err: any) {
      console.error("Error creating referral channel:", err.message);
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      return await prisma.referralChannel.findFirst({ where: props });
    } catch (err: any) {
      console.error("Error finding referral channel:", err.message);
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    try {
      return await prisma.referralChannel.findMany({ where: props });
    } catch (err: any) {
      console.error("Error finding referral channels:", err.message);
      throw new Error(err.message);
    }
  },
  updateOne: async (filter: any, props: any) => {
    try {
      const channel = await prisma.referralChannel.findFirst({ where: filter });
      if (!channel) {
        return await prisma.referralChannel.create({ data: { ...filter, ...props } });
      }
      
      return await prisma.referralChannel.update({
        where: { id: channel.id },
        data: props,
      });
    } catch (err: any) {
      console.error("Error updating referral channel:", err.message);
      throw new Error(err.message);
    }
  },
};

export const ReferralHistoryService = {
  create: async (props: any) => {
    try {
      return await prisma.referralHistory.create({ data: props });
    } catch (err: any) {
      console.error("Error creating referral history:", err.message);
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    try {
      return await prisma.referralHistory.findMany({ where: props });
    } catch (err: any) {
      console.error("Error finding referral histories:", err.message);
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      return await prisma.referralHistory.findFirst({ where: props });
    } catch (err: any) {
      console.error("Error finding one referral history:", err.message);
      throw new Error(err.message);
    }
  },
};

export const ReferrerListService = {
  create: async (props: any) => {
    try {
      return await prisma.referrerList.create({ data: props });
    } catch (err: any) {
      console.error("Error creating referrer list:", err.message);
      throw new Error(err.message);
    }
  },
  find: async (props: any) => {
    try {
      return await prisma.referrerList.findMany({ where: props });
    } catch (err: any) {
      console.error("Error finding referrer lists:", err.message);
      throw new Error(err.message);
    }
  },
  findOne: async (props: any) => {
    try {
      return await prisma.referrerList.findFirst({ where: props });
    } catch (err: any) {
      console.error("Error finding one referrer list:", err.message);
      throw new Error(err.message);
    }
  },
  updateOne: async (id: number, props: any) => {
    try {
      return await prisma.referrerList.update({
        where: { id },
        data: props,
      });
    } catch (err: any) {
      console.error("Error updating referrer list:", err.message);
      throw new Error(err.message);
    }
  },
};
