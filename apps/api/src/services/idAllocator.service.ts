import { prisma as defaultClient } from "../config/db";
import type { PrismaClient } from "../generated/prisma/client";

const BLOCK_SIZE = 1000n;

/**
 * Hands out ids from blocks of 1,000 reserved with one nextval() each (the hi/lo pattern).
 * nextval is atomic and never rolls back, so two instances can never get overlapping blocks.
 * A restart skips the rest of a block, which is harmless: the id space is 3.5 × 10^12.
 */
export function createIdAllocator(client: PrismaClient = defaultClient) {
    let next = 1n;
    let end = 0n; // empty range → the first call allocates
    let refill: Promise<void> | null = null;

    async function allocateBlock() {
        const [row] = await client.$queryRaw<[{ end: bigint }]>`SELECT nextval('url_id_block_seq') AS "end"`;
        end = row.end; // 1000, 2000, …: the block is [end − 999, end]
        next = end - BLOCK_SIZE + 1n;
    }

    return async function nextId(): Promise<bigint> {
        while (next > end) {
            // Concurrent callers share one refill instead of each burning a block
            refill ??= allocateBlock().finally(() => {
                refill = null;
            });
            await refill;
        }
        return next++;
    };
}

export const nextId = createIdAllocator();
