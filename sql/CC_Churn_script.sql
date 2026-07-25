CREATE DATABASE customer_churn_db;
   USE customer_churn_db; 
   CREATE TABLE customer_churn (
    CreditScore INT,
    Geography VARCHAR(50),
    Gender VARCHAR(10),
    Age INT,
    Tenure INT,
    Balance DECIMAL(15,2),
    NumOfProducts INT,
    HasCrCard TINYINT,
    IsActiveMember TINYINT,
    EstimatedSalary DECIMAL(15,2),
    Exited TINYINT
);
SELECT * FROM customer_churn;
SELECT COUNT(*) AS Total_Customers
FROM customer_churn;

-- Customers who churned from Germany
SELECT *
FROM customer_churn
WHERE Geography = 'Germany'
AND Exited = 1;

-- Low Credit Score Customers
SELECT *
FROM customer_churn
WHERE CreditScore < 500;

-- Average Balance by Country
SELECT Geography,
ROUND(AVG(Balance),2) AS Avg_Balance
FROM customer_churn
GROUP BY Geography;

-- Inactive Customers Who Churned
SELECT *
FROM customer_churn
WHERE IsActiveMember = 0
AND Exited = 1;

-- Top 10 Customers with Highest Balance
SELECT *
FROM customer_churn
ORDER BY Balance DESC
LIMIT 10;