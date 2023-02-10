use std::env;

pub struct CommandLine {
    pub args: Vec<String>,
    pub debug: bool,
}

pub enum CommandLineProgram {
    Help,
    Version,
    Main(CommandLine),
}

impl CommandLineProgram {
    pub fn parse() -> CommandLineProgram {
        let mut debug = false;
        let args: Vec<String> = env::args().collect();

        for arg in &args {
            match arg.as_str() {
                "-h" | "--help" => return CommandLineProgram::Help,
                "-d" | "--debug" => debug = true,
                "-v" | "--version" => return CommandLineProgram::Version,
                _ => continue,
            }
        }

        CommandLineProgram::Main(CommandLine { args, debug })
    }
}
