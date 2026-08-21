import json
import re

# All the available filenames from BlockPy client
INSTRUCTOR_FILENAMES = ("!on_run.py", "!on_change.py", "!on_eval.py",
                        "^starting_code.py", "!assignment_settings.blockpy", "!instructions.md",
                        "#extra_instructor_files.blockpy", "#extra_starting_files.blockpy")

BUILTIN_MODULES = ('Properties,Decisions,Iteration,Calculation,Output,Values,Lists,Dictionaries,Separator,Input,'
                   'Conversion').split(',')


def build_extra_starting_files(extra_starting_files):
    try:
        data = json.loads(extra_starting_files)
    except:
        return extra_starting_files
    if isinstance(data, dict):
        return json.dumps({(k[1:] if k[0] in "^?!" else k): v for k, v in data.items()})
    elif isinstance(data, list):
        return extra_starting_files
    else:
        return extra_starting_files


DEFAULT_SECTION_PATTERN = r"^(##### Part (.+))$"


def inject_code_part(existing_code, new_code, part_id):
    """
    TODO: Someone unit test the heck out of this, please...

    :param existing_code:
    :param new_code:
    :param part_id:
    :return:
    """
    raw_parts = re.split(DEFAULT_SECTION_PATTERN, existing_code, flags=re.M)
    header, raw_parts = raw_parts[0], raw_parts[1:]
    new_body = [header] if header else []
    updated = False
    for i in range(0, len(raw_parts), 3):
        full_part_header, candidate_part_id, part_body = raw_parts[i:i+3]
        new_body.append(full_part_header)
        if candidate_part_id == part_id:
            new_body.append(new_code)
            updated = True
        else:
            if part_body and part_body[0] == '\n':
                part_body = part_body[1:]
            if i != len(raw_parts) - 3 and part_body and part_body[-1] == '\n':
                part_body = part_body[:-1]
            new_body.append(part_body)
    if not updated:
        new_body.append("##### Part " + part_id)
        new_body.append(new_code)
    return "\n".join(new_body)


DEFAULT_FILENAME = 'answer.py'
DEFAULT_FILENAMES_BY_TYPE = {
    'java': 'answer.java',
    'quiz': 'answer.json',
    'typescript': 'answer.ts',
    'kettle': 'answer.ts',
    'feedback': 'answer.json'
}