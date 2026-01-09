import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { graphqlHTTP } from "express-graphql";
import { buildSchema } from "graphql";
import pool from "./db";
import cors from "cors";

type Expense = {
    name: string;
    id: string;
    amount: number;
    description: string;
    userId: string;
}
type User = {
    id: string;
    name: string;
}
type Message = {
    id: string;
    text: string
};

const app = express();
const PORT = 4000;
const messages: Message[] = [];
const users: User[] = [];
const expenses: Expense[] = [];

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true
    })
)

app.use(express.json());

// graphQL schema
const schema = buildSchema(`

    input AddExpenseInput {
    name: String!
    amount: Float!
    description: String!
    userId: ID!
    }

    type Expense {
    name: String!
    id: ID!
    amount: Float!
    description: String!
    userId: ID!
    }

    type User {
    id: ID!
    name: String
    }

    type Message {
    id: ID!
    text: String!
    }

    type Query {
        messages: [Message]
        users: [User]
        expenses: [Expense]
        expensesByUser(userId: ID!): [Expense]
        totalExpense: Float
    }

    type Mutation {
     addMessage(text: String!): Message
     addUser(name: String!): User
     addExpense(input: AddExpenseInput): Expense
     deleteExpense(id: ID!): Boolean
     updateExpense(
     id:ID!
     amount: Float!
     description: String!
     ):Expense
     }
`);

// resolver function // field name == function name 
const root = {

    addExpense: async ({ input }: { input: any }) => {

        const u = await pool.query("SELECT id FROM users WHERE id = $1", [input.userId]);

        if (u.rows.length === 0) {
            throw new Error("User does not exist")
        }
        if (input.amount <= 0) {
            throw new Error("Amount must be greater than 0");
        }
        if (input.description.trim().length < 3) {
            throw new Error("Description must be at least 3 characters long");
        }


        const id = Date.now().toString();

        const query = `
        INSERT INTO expenses (id, name, amount, description, user_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
        `;

        const result = await pool.query(query, [
            id,
            input.name,
            input.amount,
            input.description,
            input.userId
        ]);

        return {
            id: result.rows[0].id,
            name: result.rows[0].name,
            amount: result.rows[0].amount,
            description: result.rows[0].description,
            userId: result.rows[0].user_id
        };
    },
    expenses: async () => {
        const result = await pool.query("SELECT * FROM expenses");
        return result.rows.map(r => ({
            id: r.id,
            name: r.name,
            amount: r.amount,
            description: r.description,
            userId: r.user_id

        }))
    },
    totalExpense: async () => {

        const result = await pool.query(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses"
        );

        // ✔ numeric → JS number
        return Number(result.rows[0].total);
    },

    addMessage: ({ text }: { text: string }) => {
        const message = {
            id: Date.now().toString(),
            text,
        }
        messages.push(message);
        return message
    },
    messages: () => {
        return messages
    },
    addUser: async ({ name }: { name: string }) => {
        const id = Date.now().toString();
        const query = `
        INSERT INTO users (id, name)
        VALUES ($1, $2)
        RETURNING *; 
        `;
        const result = await pool.query(query, [id, name]);
        return {
            id: result.rows[0].id,
            name: result.rows[0].name
        };
    },
    users: async () => {
        const result = await pool.query(
            "SELECT id, name, created_at FROM users ORDER BY created_at DESC"
        );

        return result.rows.map(r => ({
            id: r.id,
            name: r.name
        }));
    },

    expensesByUser: async ({ userId }: { userId: string }) => {
        const result = await pool.query(
            "SELECT id, name, amount, description, user_id, created_at FROM expenses WHERE user_id = $1 ORDER BY created_at DESC", [userId]
        );
        return result.rows.map(r => ({
            id: r.id,
            name: r.name,
            amount: Number(r.amount),
            description: r.description,
            userId: r.user_id
        }));
    },
    deleteExpense: async ({ id }: { id: string }) => {
        const result = await pool.query(
            "DELETE FROM expenses WHERE id = $1",
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    },
    updateExpense: async (
        { id, amount, description }:
            { id: string, amount: number, description: string }
    ) => {
        const query = `
        UPDATE expenses
        SET amount = $2,
            description = $3
            WHERE id = $1
            RETURNING *;
      `;
        const result = await pool.query(query, [
            id,
            amount,
            description
        ])
        if (result.rows.length === 0) {
            throw new Error("Expense not found")
        }
        return {
            id: result.rows[0].id,
            name: result.rows[0].name,
            amount: Number(result.rows[0].amount),
            description: result.rows[0].description,
            userId: result.rows[0].user_id
        }
    }
}

app.use(
    "/graphql",
    graphqlHTTP({
        schema,
        rootValue: root,
        graphiql: true, // browser UI enabled
    })
);

app.get("/ping", (_req, res) => {
    res.send("Server is running");
});

app.listen(PORT, () => {
    console.log(`Server started on PORT ${PORT}`);
})
