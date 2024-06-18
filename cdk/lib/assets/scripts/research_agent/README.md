# Running AI Research Agent Locally

Make sure you have already deployed the stack at root level. Then run:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Export the following environment variables that you can get from the previously deployed stack:

```bash
export REPO_URL=<your_repo_url_ending_in_dot_git>
export AMAZON_Q_APP_ID=<your_amazon_q_app_id>
export INDEX_ID=<your_index_id>
export NEPTUNE_GRAPH_ID=<your_neptune_graph_id>
export ROLE_ARN=<your_role_arn>
```

To see the research agent in action simply run:

```bash
python3 main.py
```
