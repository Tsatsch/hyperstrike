## Development

### Run dev server

Run the development server using Poetry:

```bash
poetry run uvicorn app.main:app --reload
```

### Dependency management
use poetry, see https://python-poetry.org/

config file pyproject.toml is in root of backend

```bash
poetry add <dependency>
```
```bash
poetry install
```

```bash
poetry run python ...
```

### Env
create a local .env.local (dont push!) based on template .env
