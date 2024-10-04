import { prisma } from "@/database";


const guildID = "1276651453397864588";

for (let i = 26; i < 150; i++) {
    const name = `test${i}`;
    const response = `test${i}`;
    await prisma.customCommand.create({
        data: {
            guildId: guildID,
            name: name,
            response: response,
        }
    })
}
