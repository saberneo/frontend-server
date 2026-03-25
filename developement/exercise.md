# Mini-Mindy Big Data Edition: Developer Exercise

## 🎯 Exercise Overview

**Objective**: Build a simplified version of Mindy that demonstrates enterprise data processing using Apache Spark, Kafka, and Airflow.

**Duration**: 5 days

**Team Size**: 3 developers

---

## 📋 What You'll Build

A data pipeline system that:
1. Ingests email data from Gmail API into Kafka
2. Processes data in real-time using Spark Streaming
3. Orchestrates batch jobs with Airflow
4. Provides an AI-powered chat interface to query the processed data

---

## 🏗️ Architecture

```
Gmail API → Kafka → Spark Streaming → Delta Lake → PostgreSQL → FastAPI → Chat UI
                          ↓
                      Airflow (orchestration)
```

---

## 📦 Required Components

### Infrastructure Stack
- **Kafka**: Message broker for data ingestion
- **Spark**: Data processing (streaming + batch)
- **Airflow**: Workflow orchestration
- **Delta Lake**: Data lake with ACID transactions
- **PostgreSQL**: Structured data storage
- **FastAPI**: Backend API
- **Next.js**: Frontend chat interface

### Development Environment
- Docker Compose for all services
- Python 3.10+
- Node.js 18+
- PySpark 3.5.0

---

## 📝 Exercise Requirements

### Infrastructure Setup

**Task 1.1: Docker Environment**
Create `docker-compose.yml` with:
- Kafka + Zookeeper
- Spark (1 master, 2 workers)
- Airflow (webserver, scheduler, worker)
- PostgreSQL
- Redis

**Task 1.2: Initialize Services**
- Create Kafka topics: `emails-topic`, `processed-emails-topic`
- Initialize Airflow database and create admin user
- Create PostgreSQL database schema

**Deliverable**: All services running and healthy

---

### Data Ingestion (Kafka)

**Task 2.1: Email Producer**
Create `kafka/producers/email_producer.py`:
- Connect to Gmail API using OAuth2
- Fetch last 24 hours of emails
- Extract: subject, from, to, body, timestamp
- Produce messages to `emails-topic`
- Run every 5 minutes

**Task 2.2: Data Validation Consumer**
Create `kafka/consumers/validator.py`:
- Consume from `emails-topic`
- Validate data quality (non-null fields)
- Produce valid records to `processed-emails-topic`
- Log validation errors

**Deliverable**: 
- Producer script successfully ingesting emails to Kafka
- Consumer validating and forwarding messages

---

### Real-time Processing (Spark Streaming)

**Task 3.1: Streaming Job**
Create `spark/jobs/streaming/email_processor.py`:
- Read from `processed-emails-topic`
- Parse JSON messages
- Add enrichment fields:
  - `processed_at` timestamp
  - `sender_domain` extracted from email
  - `email_length` (body character count)
  - `is_important` (based on keywords)
- Write to Delta Lake bronze layer: `/datalake/bronze/emails`

**Task 3.2: Aggregation Stream**
In the same job:
- Create 1-hour windowed aggregations:
  - Count of emails per sender domain
  - Average email length
  - List of subjects
- Write to Delta Lake silver layer: `/datalake/silver/email_stats`

**Deliverable**: 
- Streaming job processing emails in real-time
- Data visible in Delta Lake (bronze & silver)

---

### Batch Orchestration (Airflow)

**Task 4.1: Daily Processing DAG**
Create `airflow/dags/daily_batch_dag.py` with tasks:

1. **Data Quality Check**
   - Read yesterday's emails from bronze layer
   - Calculate quality score (% of complete records)
   - Fail if quality < 95%

2. **Daily Aggregation**
   - Spark job to aggregate daily statistics:
     - Total emails received
     - Top 10 sender domains
     - Busiest hour of the day
   - Write results to gold layer: `/datalake/gold/daily_summary`

3. **Export to PostgreSQL**
   - Read gold layer data
   - Write to PostgreSQL table `daily_insights`
   - Create indexes for fast queries

4. **Send Email Report**
   - Generate summary of pipeline execution
   - Send notification email

**Schedule**: Daily at 2 AM

**Deliverable**: 
- Working Airflow DAG
- Successful execution with all tasks passing
- Data in PostgreSQL table

---

### AI Query Interface

**Task 5.1: Backend API**
Create `backend/app/routers/chat.py`:

**Endpoint**: `POST /api/chat`

Logic:
1. Receive user natural language query
2. Convert to SQL using OpenAI API
3. Execute SQL on PostgreSQL `daily_insights` table
4. Generate natural language response with AI
5. Return formatted answer + SQL used

**Example queries to support**:
- "How many emails did I receive yesterday?"
- "Which sender sent me the most emails this week?"
- "What was the busiest hour yesterday?"

**Task 5.2: Frontend Chat**
Create `frontend/src/app/chat/page.tsx`:
- Chat interface with message history
- Display AI responses
- Show SQL query used (collapsible)
- Real-time typing indicators

**Task 5.3: Analytics Dashboard**
Create `frontend/src/app/dashboard/page.tsx`:
- Display pipeline health metrics
- Show recent Airflow DAG runs
- Display data lake statistics (records in each layer)
- Kafka topic lag monitoring

**Deliverable**: 
- Working chat interface
- Successful query → SQL → response flow
- Dashboard showing pipeline metrics

---

## 🎓 Learning Objectives

By completing this exercise, you should understand:

1. **Kafka**: Event streaming, producers, consumers, topics
2. **Spark Streaming**: Real-time data processing, windowing, Delta Lake
3. **Airflow**: DAG creation, task dependencies, scheduling
4. **Data Lake Architecture**: Bronze/Silver/Gold layer pattern
5. **AI Integration**: Text-to-SQL, natural language responses

---

## 📊 Evaluation Criteria

### Technical Requirements (70%)
- ✅ All services running in Docker
- ✅ Kafka producing and consuming messages
- ✅ Spark streaming job writing to Delta Lake
- ✅ Airflow DAG executing successfully
- ✅ API converting natural language to SQL
- ✅ Chat interface displaying results

### Code Quality (20%)
- ✅ Proper error handling
- ✅ Logging throughout pipeline
- ✅ Environment variables for configuration
- ✅ Clear code comments
- ✅ Modular, reusable functions

### Documentation (10%)
- ✅ README with setup instructions
- ✅ Architecture diagram
- ✅ Example queries documented
- ✅ Troubleshooting guide

---


## 🎯 Bonus Challenges (Optional)

1. **Schema Evolution**: Handle Gmail API schema changes gracefully
2. **Late Data Handling**: Configure watermarking in Spark
3. **Cost Optimization**: Implement data retention policies
4. **Monitoring**: Add Prometheus + Grafana dashboards
5. **CI/CD**: Create GitHub Actions for automated testing

---


## 🏆 Success Criteria

**Pass**: All requirements completed
**Good**: Pass + code quality standards met
**Excellent**: Good + 2+ bonus challenges completed

---

## 🐳 Docker Deployment Architecture

### Overview

Mini-Mindy uses a **multi-container Docker architecture** with service isolation, network segregation, and persistent storage. All services communicate through internal Docker networks with minimal external exposure.

### Network Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    External Network (Host)                       │
│                                                                   │
│  Exposed Ports:                                                  │
│  • 3000  → Frontend                                              │
│  • 8000  → Backend API                                           │
│  • 8080  → Airflow UI                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Network                          │
│  • frontend (Next.js)                                            │
│  • nginx (reverse proxy)                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Application Network                       │
│  • backend (FastAPI)                                             │
│  • redis (cache)                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Processing Network                        │
│  • kafka + zookeeper                                             │
│  • spark-master                                                  │
│  • spark-worker-1, spark-worker-2                                │
│  • airflow-webserver, scheduler, worker                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                          Data Network                            │
│  • postgres (structured data)                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Production Considerations

#### Security Checklist
- [ ] Change all default passwords
- [ ] Use Docker secrets for sensitive data
- [ ] Enable SSL/TLS for all services
- [ ] Implement network policies
- [ ] Enable authentication for all UIs
- [ ] Set up firewall rules
- [ ] Regular security updates

#### Scaling Strategy
- [ ] Use Docker Swarm or Kubernetes for orchestration
- [ ] Implement horizontal scaling for workers
- [ ] Set up load balancer (nginx/HAProxy)
- [ ] Configure auto-scaling policies
- [ ] Implement service mesh (Istio) for microservices

#### Backup Strategy
- [ ] Automated PostgreSQL backups
- [ ] Delta Lake snapshots
- [ ] Configuration backup
- [ ] Disaster recovery plan

---

Good luck! 🚀