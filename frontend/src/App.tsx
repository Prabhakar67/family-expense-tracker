

import { useEffect, useState, type JSX } from "react";
import { gql } from "@apollo/client";
import client from "./graphql";
import "./App.css";

/* =========================================================
   TYPES
========================================================= */

type User = {
  id: string;
  name: string;
};

type Expense = {
  id: string;
  userId: string;
  name: string;
  amount: number;
  description?: string | null;
  createdAt: string;
};

/* =========================================================
   GRAPHQL RESULT TYPES
========================================================= */

type UsersQueryResult = {
  users: User[];
};

type ExpensesByUserResult = {
  expensesByUser: Expense[];
};

type MonthlySummaryResult = {
  monthlySummary: {
    total: number;
  };
};

type TotalMonthlyExpensesResult = {
  totalMonthlyExpenses: {
    total: number;
  };
};

type AddUserResult = {
  addUser: User;
};

type AddExpenseResult = {
  addExpense: {
    id: string;
  };
};

type UpdateExpenseResult = {
  updateExpense: {
    id: string;
  };
};

type DeleteExpenseResult = {
  deleteExpense: boolean;
};

/* =========================================================
   GRAPHQL DOCUMENTS
========================================================= */

const GET_USERS = gql`
  query {
    users {
      id
      name
    }
  }
`;

const GET_EXPENSES_BY_USER = gql`
  query ExpensesByUser($userId: ID!) {
    expensesByUser(userId: $userId) {
      id
      userId
      name
      amount
      description
      createdAt
    }
  }
`;

const MONTHLY_SUMMARY = gql`
  query MonthlySummary($userId: ID!, $month: String!) {
    monthlySummary(userId: $userId, month: $month) {
      total
    }
  }
`;

const TOTAL_MONTHLY_EXPENSES = gql`
  query TotalMonthlyExpenses($month: String!) {
    totalMonthlyExpenses(month: $month) {
      total
    }
  }
`;

const ADD_USER = gql`
  mutation AddUser($input: AddUserInput!) {
    addUser(input: $input) {
      id
      name
    }
  }
`;

const ADD_EXPENSE = gql`
  mutation AddExpense($input: AddExpenseInput!) {
    addExpense(input: $input) {
      id
    }
  }
`;

const UPDATE_EXPENSE = gql`
  mutation UpdateExpense(
    $id: ID!
    $name: String!
    $amount: Float!
    $description: String
  ) {
    updateExpense(
      id: $id
      name: $name
      amount: $amount
      description: $description
    ) {
      id
    }
  }
`;

const DELETE_EXPENSE = gql`
  mutation DeleteExpense($id: ID!) {
    deleteExpense(id: $id)
  }
`;

/* =========================================================
   APP
========================================================= */

export default function App(): JSX.Element {
  /* ---------------- STATE ---------------- */

  const [users, setUsers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const [newUserName, setNewUserName] = useState<string>("");

  const [name, setName] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const [editingExpense, setEditingExpense] =
    useState<Expense | null>(null);

  const [month, setMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  const [allUsersMonthlyTotal, setAllUsersMonthlyTotal] =
    useState<number>(0);

  /* =========================================================
     LOADERS
  ========================================================= */

  async function loadUsers(): Promise<void> {
    const res = await client.query<UsersQueryResult>({
      query: GET_USERS,
      fetchPolicy: "network-only",
    });

    if (!res.data) return;

    setUsers(res.data.users);

    if (res.data.users.length > 0 && !activeUserId) {
      setActiveUserId(res.data.users[0].id);
    }
  }

  async function loadExpenses(userId: string): Promise<void> {
    const res = await client.query<ExpensesByUserResult>({
      query: GET_EXPENSES_BY_USER,
      variables: { userId },
      fetchPolicy: "network-only",
    });

    if (!res.data) return;
    setExpenses(res.data.expensesByUser);
  }

  async function loadMonthlySummary(
    userId: string,
    month: string
  ): Promise<void> {
    const res = await client.query<MonthlySummaryResult>({
      query: MONTHLY_SUMMARY,
      variables: { userId, month },
      fetchPolicy: "network-only",
    });

    if (!res.data) return;
    setMonthlyTotal(res.data.monthlySummary.total);
  }

  async function loadAllUsersMonthlyTotal(
    month: string
  ): Promise<void> {
    const res = await client.query<TotalMonthlyExpensesResult>({
      query: TOTAL_MONTHLY_EXPENSES,
      variables: { month },
      fetchPolicy: "network-only",
    });

    if (!res.data) return;
    setAllUsersMonthlyTotal(res.data.totalMonthlyExpenses.total);
  }

  /* =========================================================
     ACTIONS
  ========================================================= */

  async function handleAddUser(): Promise<void> {
    const name = newUserName.trim();
    if (!name) return;

    const res = await client.mutate<AddUserResult>({
      mutation: ADD_USER,
      variables: { input: { name } },
    });

    if (!res.data) return;

    await loadUsers();
    setActiveUserId(res.data.addUser.id);
    setNewUserName("");
  }

  async function submitExpense(): Promise<void> {
    if (!activeUserId) return;

    if (editingExpense) {
      await client.mutate<UpdateExpenseResult>({
        mutation: UPDATE_EXPENSE,
        variables: {
          id: editingExpense.id,
          name,
          amount: Number(amount),
          description: description || null,
        },
      });
      setEditingExpense(null);
    } else {
      await client.mutate<AddExpenseResult>({
        mutation: ADD_EXPENSE,
        variables: {
          input: {
            userId: activeUserId,
            name,
            amount: Number(amount),
            description: description || null,
            createdAt: new Date().toISOString().slice(0, 10),
          },
        },
      });
    }

    setName("");
    setAmount("");
    setDescription("");

    await loadExpenses(activeUserId);
    await loadMonthlySummary(activeUserId, month);
    await loadAllUsersMonthlyTotal(month);
  }

  async function deleteExpense(id: string): Promise<void> {
    await client.mutate<DeleteExpenseResult>({
      mutation: DELETE_EXPENSE,
      variables: { id },
    });

    if (activeUserId) {
      await loadExpenses(activeUserId);
      await loadMonthlySummary(activeUserId, month);
      await loadAllUsersMonthlyTotal(month);
    }
  }

  /* =========================================================
     EFFECTS
  ========================================================= */

  useEffect(() => {
    loadUsers().catch(console.error);
    loadAllUsersMonthlyTotal(month).catch(console.error);
  }, []);

  useEffect(() => {
    if (activeUserId) {
      loadExpenses(activeUserId).catch(console.error);
      loadMonthlySummary(activeUserId, month).catch(console.error);
    }
    loadAllUsersMonthlyTotal(month).catch(console.error);
  }, [activeUserId, month]);

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div style={{ padding: 20 }}>
      <h1>Expense Tracker</h1>

      <h2>Users</h2>
      <input
        placeholder="Enter user name"
        value={newUserName}
        onChange={e => setNewUserName(e.target.value)}
      />
      <button onClick={handleAddUser}>Add User</button>

      <div style={{ marginTop: 10 }}>
        {users.map(u => (
          <label key={u.id} style={{ display: "block" }}>
            <input
              type="radio"
              checked={activeUserId === u.id}
              onChange={() => setActiveUserId(u.id)}
            />
            {u.name}
          </label>
        ))}
      </div>

      <hr />

      <h2>{editingExpense ? "Edit Expense" : "Add Expense"}</h2>

      <input
        placeholder="Expense name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <input
        placeholder="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />
      <button onClick={submitExpense}>
        {editingExpense ? "Update" : "Add"}
      </button>

      <h2>Expenses</h2>
      <ul>
        {expenses.map(e => (
          <li key={e.id}>
            {e.name} – ₹{e.amount}
            <button
              onClick={() => {
                setEditingExpense(e);
                setName(e.name);
                setAmount(String(e.amount));
                setDescription(e.description ?? "");
              }}
            >
              Edit
            </button>
            <button onClick={() => deleteExpense(e.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>

      <h3>User Total ({month}): ₹{monthlyTotal}</h3>
      <h3>All Users Total ({month}): ₹{allUsersMonthlyTotal}</h3>

      <input
        type="month"
        value={month}
        onChange={e => setMonth(e.target.value)}
      />
    </div>
  );
}







