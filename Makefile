.PHONY: demo test audit

demo:
	python -m edgewatch --mode demo

test:
	python -m unittest discover -s tests -v

audit:
	python scripts/prepublish_check.py
