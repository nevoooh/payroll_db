--
-- PostgreSQL database dump
--

\restrict WagdbDYicuSMjZgyNf4WboLeBiKaMTgZYy4C8AqAd87qKkRidy6zzP8uleIeRb8

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: businesses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.businesses (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    kra_pin character varying(20),
    password_hash text NOT NULL,
    pricing_model integer DEFAULT 3,
    created_at timestamp without time zone DEFAULT now(),
    wallet_balance numeric(10,2) DEFAULT 0,
    virtual_account_number character varying(30)
);


ALTER TABLE public.businesses OWNER TO postgres;

--
-- Name: businesses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.businesses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.businesses_id_seq OWNER TO postgres;

--
-- Name: businesses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.businesses_id_seq OWNED BY public.businesses.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    business_id integer,
    full_name character varying(255) NOT NULL,
    id_number character varying(20),
    phone character varying(20),
    gross_salary numeric(10,2) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    bank_name character varying(100),
    bank_code character varying(20),
    bank_account character varying(50),
    account_name character varying(255),
    payment_method character varying(20) DEFAULT 'bank'::character varying
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employees_id_seq OWNER TO postgres;

--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: payroll_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payroll_items (
    id integer NOT NULL,
    payroll_run_id integer,
    employee_id integer,
    gross_salary numeric(10,2),
    paye numeric(10,2),
    shif numeric(10,2),
    nssf numeric(10,2),
    platform_fee numeric(10,2),
    net_salary numeric(10,2),
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    housing_levy numeric(10,2) DEFAULT 0,
    jenga_reference character varying(100),
    jenga_ref character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying
);


ALTER TABLE public.payroll_items OWNER TO postgres;

--
-- Name: payroll_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payroll_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_items_id_seq OWNER TO postgres;

--
-- Name: payroll_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payroll_items_id_seq OWNED BY public.payroll_items.id;


--
-- Name: payroll_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payroll_runs (
    id integer NOT NULL,
    business_id integer,
    month integer NOT NULL,
    year integer NOT NULL,
    total_gross numeric(10,2),
    total_net numeric(10,2),
    total_paye numeric(10,2),
    total_shif numeric(10,2),
    total_nssf numeric(10,2),
    total_platform_fee numeric(10,2),
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    payment_reference character varying(100),
    amount_received numeric(10,2),
    jenga_reference character varying(100),
    total_housing_levy numeric(10,2) DEFAULT 0
);


ALTER TABLE public.payroll_runs OWNER TO postgres;

--
-- Name: payroll_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payroll_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_runs_id_seq OWNER TO postgres;

--
-- Name: payroll_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payroll_runs_id_seq OWNED BY public.payroll_runs.id;


--
-- Name: pending_deposits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pending_deposits (
    id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    reference character varying(100) NOT NULL,
    sender_name character varying(150),
    status character varying(20) DEFAULT 'unclaimed'::character varying,
    claimed_by integer,
    claimed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    sender_account character varying(50)
);


ALTER TABLE public.pending_deposits OWNER TO postgres;

--
-- Name: pending_deposits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pending_deposits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pending_deposits_id_seq OWNER TO postgres;

--
-- Name: pending_deposits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pending_deposits_id_seq OWNED BY public.pending_deposits.id;


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallet_transactions (
    id integer NOT NULL,
    business_id integer,
    type character varying(10) NOT NULL,
    amount numeric(10,2) NOT NULL,
    reference character varying(100),
    description character varying(255),
    balance_after numeric(10,2),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.wallet_transactions OWNER TO postgres;

--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wallet_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wallet_transactions_id_seq OWNER TO postgres;

--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wallet_transactions_id_seq OWNED BY public.wallet_transactions.id;


--
-- Name: businesses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.businesses ALTER COLUMN id SET DEFAULT nextval('public.businesses_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: payroll_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_items ALTER COLUMN id SET DEFAULT nextval('public.payroll_items_id_seq'::regclass);


--
-- Name: payroll_runs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_runs ALTER COLUMN id SET DEFAULT nextval('public.payroll_runs_id_seq'::regclass);


--
-- Name: pending_deposits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_deposits ALTER COLUMN id SET DEFAULT nextval('public.pending_deposits_id_seq'::regclass);


--
-- Name: wallet_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions ALTER COLUMN id SET DEFAULT nextval('public.wallet_transactions_id_seq'::regclass);


--
-- Name: businesses businesses_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_email_key UNIQUE (email);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: payroll_items payroll_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_items
    ADD CONSTRAINT payroll_items_pkey PRIMARY KEY (id);


--
-- Name: payroll_runs payroll_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_pkey PRIMARY KEY (id);


--
-- Name: pending_deposits pending_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_deposits
    ADD CONSTRAINT pending_deposits_pkey PRIMARY KEY (id);


--
-- Name: pending_deposits pending_deposits_reference_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_deposits
    ADD CONSTRAINT pending_deposits_reference_key UNIQUE (reference);


--
-- Name: wallet_transactions unique_reference; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT unique_reference UNIQUE (reference);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: employees employees_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: payroll_items payroll_items_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_items
    ADD CONSTRAINT payroll_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: payroll_items payroll_items_payroll_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_items
    ADD CONSTRAINT payroll_items_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id);


--
-- Name: payroll_runs payroll_runs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: pending_deposits pending_deposits_claimed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_deposits
    ADD CONSTRAINT pending_deposits_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.businesses(id);


--
-- Name: wallet_transactions wallet_transactions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- PostgreSQL database dump complete
--

\unrestrict WagdbDYicuSMjZgyNf4WboLeBiKaMTgZYy4C8AqAd87qKkRidy6zzP8uleIeRb8

