"""Codebound game bridge; executed inside the bundled browser Python runtime."""
import ast
import builtins
import json
import sys
import traceback
import io
import types


def run_case(code, level):
    events, output = [], []
    cells = level["map"]
    start = next(({"x": x, "y": y} for y, row in enumerate(cells)
                  for x, char in enumerate(row) if char == "S"), {"x": 1, "y": 1})
    state = {"player": start, "energy": level.get("energy", 100), "collected": 0,
             "batteries": [{"x": x, "y": y} for y, row in enumerate(cells)
                           for x, char in enumerate(row) if char == "B"]}
    current_line, ticks, actions = 0, 0, 0
    variables, namespace = {}, {}
    called_functions, recursive_functions, instance_classes = set(), set(), set()
    student_class_names = set()
    inputs = iter(level.get("input", []))
    files = dict(level.get('dataFiles', {}))
    module_sources = dict(level.get('modules', {}))
    module_cache = {}

    def snapshot(kind, text=None):
        if len(events) >= 650:
            return
        event = {"kind": kind, "line": current_line, "state": json.loads(json.dumps(state)),
                 "variables": dict(variables)}
        if text is not None:
            event["text"] = text
        events.append(event)

    def collect_values(values):
        variables.clear()
        for name, value in values.items():
            if name.startswith("_") or name == "robot":
                continue
            if type(value) in (int, float, str, bool, type(None)):
                variables[name] = str(value)[:120] if type(value) is str else value
            elif type(value) in (list, tuple, dict, set) and len(value) <= 20:
                variables[name] = repr(value)[:120]
            elif type(value).__name__ in student_class_names:
                instance_classes.add(type(value).__name__)
                attributes = object.__getattribute__(value, '__dict__')
                visible = []
                for key, item in attributes.items():
                    if not key.startswith('_') and type(item) in (int, float, str, bool, type(None), list, dict, tuple):
                        visible.append(key + '=' + repr(item)[:60])
                    if len(visible) >= 6:
                        break
                variables[name] = (type(value).__name__ + '(' + ', '.join(visible) + ')')[:160]
            if len(variables) >= 16:
                break

    def trace(frame, event, arg):
        nonlocal ticks, current_line
        if not frame.f_code.co_filename.startswith('<student'):
            return trace
        if event == 'call' and frame.f_code.co_name != '<module>':
            called_functions.add(frame.f_code.co_name)
            ancestor = frame.f_back
            while ancestor is not None:
                if ancestor.f_code is frame.f_code:
                    recursive_functions.add(frame.f_code.co_name)
                    break
                ancestor = ancestor.f_back
        if event == "line":
            ticks += 1
            if ticks > 3000:
                raise RuntimeError("执行步骤太多：请检查循环的结束条件，或缩小循环次数。")
            current_line = frame.f_lineno
            collect_values(frame.f_locals)
            snapshot("line")
        return trace

    def printed(*args, sep=" ", end="\n", **kwargs):
        text = sep.join(str(value) for value in args) + end
        if sum(len(item) for item in output) + len(text) > 12000:
            raise RuntimeError("输出内容太多了，请减少打印次数。")
        output.append(text)
        snapshot("output", text)

    def read_input(prompt=""):
        if prompt:
            printed(prompt, end="")
        try:
            return str(next(inputs))
        except StopIteration:
            raise EOFError("输入数据已经读完了；检查 input() 的调用次数。") from None

    def virtual_open(name, mode='r', encoding=None, **kwargs):
        if not isinstance(name, str) or '/' in name or '\\' in name or name in ('.', '..'):
            raise ValueError('只能访问虚拟档案柜中的文件名。')
        if mode not in ('r', 'w', 'a'):
            raise ValueError('本课程支持文本模式 r、w、a。')
        if encoding not in (None, 'utf-8', 'UTF-8'):
            raise ValueError('请使用 UTF-8 编码。')
        if mode == 'r' and name not in files:
            raise FileNotFoundError(name)
        class Document(io.StringIO):
            def close(self):
                if not self.closed and mode != 'r':
                    value = self.getvalue()
                    if len(value) > 20000:
                        raise ValueError('虚拟文件超过 20000 字符。')
                    files[name] = value
                super().close()
            def write(self, text):
                if mode == 'r':
                    raise io.UnsupportedOperation('文件以只读方式打开。')
                written = super().write(text)
                if self.tell() > 20000:
                    raise ValueError('虚拟文件超过 20000 字符。')
                files[name] = self.getvalue()
                return written
        handle = Document('' if mode == 'w' else files.get(name, ''))
        if mode == 'w':
            files[name] = ''
        if mode == 'a':
            handle.seek(0, 2)
        return handle

    student_builtins = dict(builtins.__dict__)

    def student_import(name, globals=None, locals=None, fromlist=(), level=0):
        if level:
            raise ImportError('本课程使用同目录模块的绝对导入。')
        if name + '.py' in module_sources:
            if name not in module_cache:
                module = types.ModuleType(name)
                module.__dict__['__builtins__'] = student_builtins
                module_cache[name] = module
                filename = '<student:' + name + '.py>'
                module_tree = ast.parse(module_sources[name + '.py'], filename=filename)
                student_class_names.update(node.name for node in ast.walk(module_tree) if isinstance(node, ast.ClassDef))
                exec(compile(module_tree, filename, 'exec'), module.__dict__)
            return module_cache[name]
        if name not in ('math', 'random', 'json'):
            raise ImportError('本课程可使用 math、random、json 和工作区里的模块。')
        return builtins.__import__(name, globals, locals, fromlist, 0)

    student_builtins.update(open=virtual_open, __import__=student_import)

    class Robot:
        @property
        def energy(self):
            return state["energy"]

        def _move(self, dx, dy, steps=1):
            nonlocal actions
            if type(steps) is not int or not 0 <= steps <= 50:
                raise ValueError("移动步数需要是 0 到 50 之间的整数。")
            for _ in range(steps):
                actions += 1
                if actions > 150:
                    raise RuntimeError("动作次数太多，请检查循环是否会停止。")
                x, y = state["player"]["x"] + dx, state["player"]["y"] + dy
                if not (0 <= y < len(cells) and 0 <= x < len(cells[y])) or cells[y][x] == "#":
                    raise ValueError("前面是墙壁，Byte 走不过去。检查移动方向与步数。")
                state["player"] = {"x": x, "y": y}
                snapshot("move")

        def right(self, steps=1):
            self._move(1, 0, steps)

        def left(self, steps=1):
            self._move(-1, 0, steps)

        def up(self, steps=1):
            self._move(0, -1, steps)

        def down(self, steps=1):
            self._move(0, 1, steps)

        def collect(self):
            if state["player"] not in state["batteries"]:
                raise ValueError("脚下没有电池。先移动到电池所在的位置，再收集。")
            state["batteries"].remove(state["player"])
            state["collected"] += 1
            snapshot("collect")

        def charge(self):
            nonlocal actions
            actions += 1
            if actions > 150:
                raise RuntimeError("充电次数太多，请检查 while 的条件。")
            state["energy"] = min(100, state["energy"] + 20)
            snapshot("charge")

        def at_goal(self):
            p = state["player"]
            return cells[p["y"]][p["x"]] == "G"

        def say(self, text):
            printed(text)

    student_builtins.update(print=printed, input=read_input)
    namespace.update({"robot": Robot(), "print": printed, "input": read_input,
                      "__name__": '__main__', "__builtins__": student_builtins})
    error, nodes = None, []
    try:
        if len(code) > 20000:
            raise ValueError("代码超过 20000 字符，请先缩短代码。")
        tree = ast.parse(code, filename="<student>")
        student_class_names.update(node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef))
        nodes = list({type(node).__name__ for node in ast.walk(tree)})
        sys.settrace(trace)
        exec(compile(tree, "<student>", "exec"), namespace, namespace)
    except BaseException as exc:
        sys.settrace(None)
        line = getattr(exc, "lineno", None) or current_line
        error_file = 'main.py'
        for frame in traceback.extract_tb(exc.__traceback__):
            if frame.filename.startswith('<student'):
                line = frame.lineno
                error_file = frame.filename[9:-1] if frame.filename.startswith('<student:') else 'main.py'
        detail = str(exc)
        kind = type(exc).__name__
        if isinstance(exc, IndentationError):
            message = "缩进没有对齐。if、for、while 后面的代码通常需要缩进 4 个空格。"
        elif isinstance(exc, SyntaxError):
            message = "这一行的语法有问题。检查英文括号、引号，以及 if / for / while 后面的冒号。"
            if "expected ':'" in detail:
                message = "这一行末尾缺少英文冒号 :。补上后，下一行缩进 4 个空格。"
            if any(char in code for char in "（）：，‘’“”"):
                message += " 代码符号请使用英文输入法；引号里的中文不受影响。"
        elif isinstance(exc, NameError):
            message = "这个名字还没有定义。检查拼写，并确认变量在使用前已经赋值。"
        elif isinstance(exc, IndexError):
            message = '索引超出范围。索引从 0 开始，最后一个位置是长度减 1；先检查列表或字符串是否为空。'
        elif isinstance(exc, KeyError):
            message = '字典里没有这个键。先用 in 检查，或使用 get 提供默认值。'
        elif isinstance(exc, AttributeError):
            message = "没有找到这个属性或方法。检查对象和名称的拼写，并确认属性已先赋值。机器人动作包括 right、left、up、down、collect、charge。"
        elif isinstance(exc, TypeError):
            message = "数据类型或参数不合适。检查数字和文字是否混用，以及函数参数是否正确。"
        elif isinstance(exc, ZeroDivisionError):
            message = "除数不能是 0。先检查参与运算的数字。"
        elif isinstance(exc, RecursionError):
            message = "递归调用太深了。检查是否写了结束条件，以及每次调用是否更接近结束条件。"
        else:
            message = detail or "程序提前结束了，请检查代码。"
        error = {"line": line, "file": error_file, "type": kind, "message": message, "detail": detail[:600]}
    finally:
        sys.settrace(None)
    collect_values(namespace)
    snapshot("end")
    return {"state": state, "events": events, "output": "".join(output),
            "variables": variables, "nodes": nodes, "assertions": sum(isinstance(node, ast.Assert) for node in ast.walk(tree)) if error is None else 0, "files": files, "calledFunctions": sorted(called_functions),
            "recursiveFunctions": sorted(recursive_functions), "instanceClasses": sorted(instance_classes), "error": error}


def execute_request(request_json):
    request = json.loads(request_json)
    level = request["level"]
    result = run_case(request["code"], level)
    result["checks"] = []
    if result["error"] is None:
        for case in level.get("cases", []):
            variant = dict(level)
            variant.update({key: case[key] for key in ('input', 'map', 'energy', 'dataFiles') if key in case})
            checked = run_case(request["code"], variant)
            rules = case.get('rules', level.get('rules', {}))
            player = checked['state']['player']
            valid = checked['error'] is None
            if 'output' in case:
                valid = valid and checked['output'].strip() == case['output'].strip()
            if rules.get('atGoal'):
                valid = valid and variant['map'][player['y']][player['x']] == 'G'
            if rules.get('collected'):
                valid = valid and checked['state']['collected'] >= rules['collected']
            for name, expected in case.get('files', rules.get('files', {})).items():
                actual = checked['files'].get(name)
                matches = actual == expected
                if name.endswith('.json') and not matches:
                    try:
                        matches = json.loads(actual) == json.loads(expected)
                    except (ValueError, TypeError):
                        matches = False
                valid = valid and matches
            result["checks"].append({"passed": valid,
                                     "expected": case.get('output', ''), "actual": checked['output'],
                                     "error": checked["error"]})
    return json.dumps(result, ensure_ascii=False, allow_nan=False)
