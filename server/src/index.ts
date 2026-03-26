












































import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { graphqlHTTP } from "express-graphql";
import { buildSchema } from "graphql";
import pool from "./db";

const app = express();
const PORT = 4000;

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

const schema = buildSchema(`
  type User {
    id: ID!
    name: String!
  }

  type Expense {
    id: ID!
    userId: ID!
    name: String!
    amount: Float!
    description: String
    createdAt: String!
  }

  input AddUserInput {
    name: String!
  }

  input AddExpenseInput {
    userId: ID!
    name: String!
    amount: Float!
    description: String
    createdAt: String!
  }

  type MonthlySummary {
    total: Float!
  }

  type Query {
    users: [User!]!
    expensesByUser(userId: ID!): [Expense!]!
    monthlySummary(userId: ID!, month: String!): MonthlySummary!
    totalMonthlyExpenses(month: String!): MonthlySummary!
  }

  type Mutation {
    addUser(input: AddUserInput!): User
    addExpense(input: AddExpenseInput!): Expense
    updateExpense(
      id: ID!
      name: String!
      amount: Float!
      description: String
    ): Expense
    deleteExpense(id: ID!): Boolean
  }
`);

const root = {
    users: async () => {
        const r = await pool.query(
            "SELECT id, name FROM users ORDER BY created_at ASC"
        );
        return r.rows;
    },

    addUser: async ({ input }: any) => {
        const name = input.name.trim();
        if (!name) throw new Error("User name required");

        const exists = await pool.query(
            "SELECT id FROM users WHERE LOWER(name)=LOWER($1)",
            [name]
        );
        if (exists.rows.length) throw new Error("User already exists");

        const id = Date.now().toString();
        const r = await pool.query(
            "INSERT INTO users (id,name) VALUES ($1,$2) RETURNING *",
            [id, name]
        );
        return r.rows[0];
    },

    expensesByUser: async ({ userId }: any) => {
        const r = await pool.query(
            "SELECT * FROM expenses WHERE user_id=$1 ORDER BY created_at DESC",
            [userId]
        );

        return r.rows.map((e: any) => ({
            id: e.id,
            userId: e.user_id,
            name: e.name,
            amount: Number(e.amount),
            description: e.description,
            createdAt: e.created_at,
        }));
    },

    addExpense: async ({ input }: any) => {
        const id = Date.now().toString();

        const r = await pool.query(
            `INSERT INTO expenses
      (id,user_id,name,amount,description,created_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *`,
            [
                id,
                input.userId,
                input.name,
                input.amount,
                input.description,
                input.createdAt,
            ]
        );

        const e = r.rows[0];
        return {
            id: e.id,
            userId: e.user_id,
            name: e.name,
            amount: Number(e.amount),
            description: e.description,
            createdAt: e.created_at,
        };
    },

    updateExpense: async ({ id, name, amount, description }: any) => {
        const r = await pool.query(
            `UPDATE expenses
       SET name=$2, amount=$3, description=$4
       WHERE id=$1 RETURNING *`,
            [id, name, amount, description]
        );

        const e = r.rows[0];
        return {
            id: e.id,
            userId: e.user_id,
            name: e.name,
            amount: Number(e.amount),
            description: e.description,
            createdAt: e.created_at,
        };
    },

    deleteExpense: async ({ id }: any) => {
        const r = await pool.query("DELETE FROM expenses WHERE id=$1", [id]);
        return (r.rowCount ?? 0) > 0;
    },

    totalMonthlyExpenses: async ({ month }: any) => {
        const r = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE TO_CHAR(created_at, 'YYYY-MM') = $1`,
            [month]
        );

        return { total: Number(r.rows[0].total) };
    },


    monthlySummary: async ({ userId, month }: any) => {
        const r = await pool.query(
            `SELECT COALESCE(SUM(amount),0) total
       FROM expenses
       WHERE user_id=$1
       AND TO_CHAR(created_at,'YYYY-MM')=$2`,
            [userId, month]
        );
        return { total: Number(r.rows[0].total) };
    },
};

app.use(
    "/graphql",
    graphqlHTTP({
        schema,
        rootValue: root,
        graphiql: true,
    })
);

app.listen(PORT, () =>
    console.log(`🚀 Server running at http://localhost:${PORT}/graphql`)
);
