.PHONY: help start finish finish-strict test lint lint-changed build

help:
	@echo "Targets:"
	@echo "  make start TYPE=feature NAME=add-catalog-search [RUN_TESTS=1]"
	@echo "  make finish MSG='add catalog search' [INCLUDE_UNTRACKED=1] [DELETE_BRANCH=1]"
	@echo "  make finish-strict MSG='add catalog search' [INCLUDE_UNTRACKED=1] [DELETE_BRANCH=1]"
	@echo "  make test | lint | lint-changed | build"

start:
	@if [ -z "$(TYPE)" ] || [ -z "$(NAME)" ]; then \
		echo "Usage: make start TYPE=feature NAME=add-catalog-search [RUN_TESTS=1]"; \
		exit 1; \
	fi
	@if [ "$(RUN_TESTS)" = "1" ]; then \
		npm run workflow:start -- $(TYPE) $(NAME) --run-tests; \
	else \
		npm run workflow:start -- $(TYPE) $(NAME); \
	fi

finish:
	@if [ -z "$(MSG)" ]; then \
		echo "Usage: make finish MSG='summary' [INCLUDE_UNTRACKED=1] [DELETE_BRANCH=1]"; \
		exit 1; \
	fi
	@set -- --message "$(MSG)"; \
	if [ "$(INCLUDE_UNTRACKED)" = "1" ]; then set -- "$$@" --include-untracked; fi; \
	if [ "$(DELETE_BRANCH)" = "1" ]; then set -- "$$@" --delete-branch; fi; \
	npm run workflow:finish -- "$$@"

finish-strict:
	@if [ -z "$(MSG)" ]; then \
		echo "Usage: make finish-strict MSG='summary' [INCLUDE_UNTRACKED=1] [DELETE_BRANCH=1]"; \
		exit 1; \
	fi
	@set -- --message "$(MSG)"; \
	if [ "$(INCLUDE_UNTRACKED)" = "1" ]; then set -- "$$@" --include-untracked; fi; \
	if [ "$(DELETE_BRANCH)" = "1" ]; then set -- "$$@" --delete-branch; fi; \
	npm run workflow:finish:strict -- "$$@"

test:
	npm test

lint:
	npm run lint

lint-changed:
	npm run lint:changed

build:
	npm run build
