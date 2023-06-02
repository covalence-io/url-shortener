import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import mysql from "mysql";

interface UrlPair {
    original: string;
    shortened: string;
}

const pool = mysql.createPool(process.env.DB_URL!);

const Query = <T = mysql.OkPacket>(sql: string, values: unknown[] = []) => {
    return new Promise<T>((resolve, reject) => {
        pool.query(sql, values, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};

const find = (url: string) => Query<UrlPair[]>("SELECT * FROM Urls WHERE original=? OR shortened=?", [url, url]);
const create = (original: string, shortened: string) => Query("INSERT INTO Urls SET ?", [{ original, shortened }]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "POST") {
        const { original } = req.body;
        try {
            const [foundUrl] = await find(original);

            if (foundUrl) {
                res.status(200).json({ url: foundUrl.shortened });
            } else {
                const slug = crypto.pseudoRandomBytes(6).toString("hex");
                const shortened = `${process.env.BASE_URL}/?u=${slug}`;
                await create(original, shortened);
                res.status(201).json({ url: shortened });
            }
        } catch (error) {
            res.status(500).json({ message: "Couldn't create shortened URL", error });
        }
    }

    if (req.method === "GET") {
        const { original } = req.query as { original: string };

        try {
            const [foundUrl] = await find(original);

            if (!foundUrl) {
                res.status(404).json({ message: "That link is not valid :(" });
            } else {
                res.json({ original: foundUrl.original });
            }
        } catch (error) {
            res.status(500).json({ message: "Error in attempting to find shortened URL", error });
        }
    }
}
